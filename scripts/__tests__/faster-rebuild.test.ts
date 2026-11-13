import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cacheKey,
  createWikiClient,
  pinBuild,
} from "../bootstrap-fixtures/fetch.js";
import {
  stockListPath,
  stockPage,
  stockTypesOf,
  takeFromList,
} from "../bootstrap-fixtures/stock.js";
import type { WikiVehicle } from "../bootstrap-fixtures/types.js";
import { decide, versionOf } from "../refresh/early.js";

// ADR-059: the rebuild reads the stock parts from the wiki's list, the steps of one run share
// their reads, and the News workflow starts the refresh when the wiki serves CIG's new build.

const BUILD = "4.10.3-LIVE.13165946";
const OLD = "4.10.2-LIVE.12881860";

describe("pinBuild", () => {
  it("names the run's build in a ship, part or blueprint read that names none", () => {
    expect(pinBuild("/api/vehicles/abc", BUILD)).toBe(
      `/api/vehicles/abc?version=${BUILD}`,
    );
    expect(pinBuild("/api/items?filter[type]=Cooler", BUILD)).toBe(
      `/api/items?filter[type]=Cooler&version=${BUILD}`,
    );
    // A read that names a build, a check of the builds, and a run with no build go as written.
    expect(pinBuild(`/api/vehicles/abc?version=${OLD}`, BUILD)).toBe(
      `/api/vehicles/abc?version=${OLD}`,
    );
    expect(pinBuild("/api/game-versions/default", BUILD)).toBe(
      "/api/game-versions/default",
    );
    expect(pinBuild("/api/vehicles/abc", null)).toBe("/api/vehicles/abc");
  });
});

describe("cacheKey", () => {
  it("keeps only ship, part and blueprint reads that name their build", () => {
    expect(cacheKey(`/api/items/abc?version=${BUILD}`)).toBe(
      `/api/items/abc?version=${BUILD}`,
    );
    expect(cacheKey("/api/items/abc")).toBeNull();
    expect(cacheKey(`/api/game-versions?version=${BUILD}`)).toBeNull();
    expect(cacheKey("/api/game-versions/default")).toBeNull();
  });

  it("gives a ship one key with or without its hardpoints, and one per build", () => {
    const plain = cacheKey(`/api/vehicles/abc?version=${BUILD}`);
    expect(
      cacheKey(`/api/vehicles/abc?include=hardpoints&version=${BUILD}`),
    ).toBe(plain);
    expect(cacheKey(`/api/vehicles/abc?version=${OLD}`)).not.toBe(plain);
    // A list with its hardpoints asked for is another read.
    expect(cacheKey(`/api/vehicles?include=hardpoints&version=${BUILD}`)).toBe(
      `/api/vehicles?include=hardpoints&version=${BUILD}`,
    );
    // Parameter order does not matter.
    expect(
      cacheKey(
        `/api/items?page[number]=2&filter[type]=Cooler&version=${BUILD}`,
      ),
    ).toBe(
      cacheKey(
        `/api/items?filter[type]=Cooler&version=${BUILD}&page[number]=2`,
      ),
    );
  });
});

describe("the run's cache", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });
  const answering = () =>
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { url } }),
    }));

  it("answers a later step's read of the same ship with no request", async () => {
    dir = mkdtempSync(join(tmpdir(), "wiki-cache-"));
    const fetch = answering();
    const options = {
      fetch,
      userAgent: "test/0",
      spacingMs: 0,
      cacheDir: dir,
      build: BUILD,
    };
    // The patch snapshot names the build; the catalog asks for the hardpoints.
    const first = createWikiClient(options);
    await first.getJson(
      `/api/vehicles/abc?include=hardpoints&version=${BUILD}`,
    );
    // A second process (the next step) with the same folder, asking plainly.
    const second = createWikiClient(options);
    expect(await second.getJson("/api/vehicles/abc")).toEqual({
      data: {
        url: `https://api.star-citizen.wiki/api/vehicles/abc?include=hardpoints&version=${BUILD}`,
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([first.requests, second.requests, second.cached]).toEqual([1, 0, 1]);
    // The check of the wiki's build is never kept.
    await second.getJson("/api/game-versions/default");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it("never serves one build's read to a run on another", async () => {
    dir = mkdtempSync(join(tmpdir(), "wiki-cache-"));
    const fetch = answering();
    const base = { fetch, userAgent: "test/0", spacingMs: 0, cacheDir: dir };
    await createWikiClient({ ...base, build: OLD }).getJson(
      "/api/vehicles/abc",
    );
    // The wiki moved its default between the passes: the next pass reads the new build.
    const next = createWikiClient({ ...base, build: BUILD });
    expect(await next.getJson("/api/vehicles/abc")).toEqual({
      data: {
        url: `https://api.star-citizen.wiki/api/vehicles/abc?version=${BUILD}`,
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps nothing without a build or a folder, and nothing that failed", async () => {
    dir = mkdtempSync(join(tmpdir(), "wiki-cache-"));
    const failing = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    const client = createWikiClient({
      fetch: failing,
      userAgent: "test/0",
      spacingMs: 0,
      cacheDir: dir,
      build: BUILD,
    });
    await expect(client.getJson("/api/items/gone")).rejects.toThrow("HTTP 404");
    expect(readdirSync(dir)).toHaveLength(0);
    for (const options of [
      { cacheDir: dir, build: null },
      { cacheDir: null, build: BUILD },
    ]) {
      const none = createWikiClient({
        fetch: answering(),
        userAgent: "test/0",
        spacingMs: 0,
        ...options,
      });
      await none.getJson("/api/items/a");
      await none.getJson("/api/items/a");
      expect(none.requests).toBe(2);
    }
    expect(readdirSync(dir)).toHaveLength(0);
  });
});

describe("the stock parts' list read", () => {
  const equipped = (class_name: string, type: string) => ({
    uuid: `${class_name}-uuid`,
    name: class_name,
    class_name,
    type,
    version: BUILD,
  });
  const ship = {
    ports: [
      {
        name: "a",
        type: "Cooler",
        equipped_item: equipped("COOL_A", "Cooler"),
      },
      {
        name: "b",
        type: "Turret",
        equipped_item: equipped("TURR_B", "TurretBase"),
        ports: [
          {
            name: "c",
            type: "WeaponGun",
            equipped_item: equipped("GUN_C", "WeaponGun"),
          },
        ],
      },
      { name: "d", type: "Seat", equipped_item: equipped("SEAT_D", "Seat") },
      { name: "e", type: "", equipped_item: null },
    ],
  } as unknown as Pick<WikiVehicle, "ports">;

  it("asks for the types of the parts the rebuild keeps, nested ports included", () => {
    const stock = new Map([
      ["COOL_A", "x"],
      ["TURR_B", "y"],
      ["GUN_C", "z"],
    ]);
    expect(stockTypesOf([ship, ship], stock)).toEqual([
      "Cooler",
      "TurretBase",
      "WeaponGun",
    ]);
    expect(stockTypesOf([ship], new Map())).toEqual([]);
  });

  it("pages the list with every type at once and the placeholders in", () => {
    expect(stockListPath(["Cooler", "MainThruster"], 3)).toBe(
      "/api/items?filter[type]=Cooler,MainThruster&filter[include_irrelevant]=true&page[size]=200&page[number]=3",
    );
  });

  it("checks each record on its own, so one odd record never halts the rebuild", () => {
    const good = {
      uuid: "u1",
      name: "<= PLACEHOLDER =>",
      class_name: "THR_A",
      type: "ManneuverThruster",
      manufacturer: { code: "AEGS", name: "Aegis Dynamics" },
      version: BUILD,
    };
    const page = stockPage({
      data: [good, { uuid: "u2", name: "", class_name: "BAD", type: "X" }],
      meta: { last_page: 19 },
    });
    expect([page.records, page.lastPage, page.refused]).toEqual([
      [good],
      19,
      1,
    ]);
    // A page that cannot say how many pages there are halts.
    expect(() => stockPage({ data: [good] })).toThrow();
  });

  it("takes a listed record only when it is that part, for the pack's build", () => {
    const record = { class_name: "THR_A", version: BUILD };
    expect(takeFromList(record, "THR_A", BUILD)).toBe(true);
    expect(takeFromList(record, "THR_B", BUILD)).toBe(false);
    expect(takeFromList(record, "THR_A", OLD)).toBe(false);
    expect(takeFromList(undefined, "THR_A", BUILD)).toBe(false);
  });
});

describe("the early start", () => {
  it("reads a build's version", () => {
    expect(versionOf(OLD)).toBe("4.10.2");
    expect(versionOf("nonsense")).toBeNull();
  });

  it("asks for a build newer than the pack's, once", () => {
    expect(decide(OLD, BUILD, null)).toMatchObject({
      dispatch: true,
      build: BUILD,
    });
    expect(decide(OLD, OLD, null).dispatch).toBe(false);
    expect(decide(BUILD, OLD, null).dispatch).toBe(false);
    expect(
      decide(OLD, BUILD, { build: BUILD, asked_at: "2026-11-13T15:10:00Z" })
        .dispatch,
    ).toBe(false);
    expect(
      decide(OLD, BUILD, { build: OLD, asked_at: "2026-10-09T08:00:00Z" })
        .dispatch,
    ).toBe(true);
    expect(decide(null, BUILD, null).dispatch).toBe(true);
  });
});
