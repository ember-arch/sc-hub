import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheKey, createWikiClient } from "../bootstrap-fixtures/fetch.js";
import { stockListPath, stockTypesOf } from "../bootstrap-fixtures/stock.js";
import type { WikiVehicle } from "../bootstrap-fixtures/types.js";
import { decide, versionOf } from "../refresh/early.js";

// ADR-059: the rebuild reads the stock parts from the wiki's list, the steps of one run share
// their reads, and the News workflow starts the refresh when the wiki serves CIG's new build.

const BUILD = "4.10.3-LIVE.13165946";

describe("cacheKey", () => {
  it("keeps ships, parts and blueprints, and never a check of the builds", () => {
    expect(cacheKey("/api/vehicles/abc", null)).toBe("/api/vehicles/abc");
    expect(cacheKey("/api/items/abc", null)).toBe("/api/items/abc");
    expect(cacheKey("/api/blueprints?page[size]=200", null)).toBe(
      "/api/blueprints?page[size]=200",
    );
    expect(cacheKey("/api/game-versions/default", BUILD)).toBeNull();
    expect(cacheKey("/api/game-versions?page[size]=100", BUILD)).toBeNull();
  });

  it("gives a ship one key with or without its hardpoints, and the run's build as the default", () => {
    const plain = cacheKey("/api/vehicles/abc", BUILD);
    expect(cacheKey("/api/vehicles/abc?include=hardpoints", BUILD)).toBe(plain);
    expect(
      cacheKey(`/api/vehicles/abc?include=hardpoints&version=${BUILD}`, BUILD),
    ).toBe(plain);
    // Another build is another read; so is a list with its hardpoints asked for.
    expect(
      cacheKey("/api/vehicles/abc?version=4.10.2-LIVE.12881860", BUILD),
    ).not.toBe(plain);
    expect(cacheKey("/api/vehicles?include=hardpoints", BUILD)).toBe(
      "/api/vehicles?include=hardpoints",
    );
    // Parameter order does not matter.
    expect(
      cacheKey(
        `/api/items?page[number]=2&filter[type]=Cooler&version=${BUILD}`,
        BUILD,
      ),
    ).toBe(cacheKey("/api/items?filter[type]=Cooler&page[number]=2", BUILD));
  });
});

describe("the run's cache", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir !== null) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it("answers a later step's read of the same ship with no request", async () => {
    dir = mkdtempSync(join(tmpdir(), "wiki-cache-"));
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { uuid: "abc" } }),
    }));
    const options = {
      fetch,
      userAgent: "test/0",
      spacingMs: 0,
      cacheDir: dir,
      build: BUILD,
    };
    const first = createWikiClient(options);
    expect(
      await first.getJson(
        `/api/vehicles/abc?include=hardpoints&version=${BUILD}`,
      ),
    ).toEqual({ data: { uuid: "abc" } });
    // A second process (the next step) with the same folder.
    const second = createWikiClient(options);
    expect(await second.getJson("/api/vehicles/abc")).toEqual({
      data: { uuid: "abc" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([first.requests, second.requests, second.cached]).toEqual([1, 0, 1]);
    // The check of the wiki's build is never kept.
    await second.getJson("/api/game-versions/default");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it("keeps nothing without a folder, and nothing that failed", async () => {
    dir = mkdtempSync(join(tmpdir(), "wiki-cache-"));
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    const client = createWikiClient({
      fetch,
      userAgent: "test/0",
      spacingMs: 0,
      cacheDir: dir,
    });
    await expect(client.getJson("/api/items/gone")).rejects.toThrow("HTTP 404");
    expect(readdirSync(dir)).toHaveLength(0);
    const none = createWikiClient({
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
      })),
      userAgent: "test/0",
      spacingMs: 0,
      cacheDir: null,
    });
    await none.getJson("/api/items/a");
    await none.getJson("/api/items/a");
    expect(none.requests).toBe(2);
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
});

describe("the early start", () => {
  const PACK = "4.10.2-LIVE.12881860";

  it("reads a build's version", () => {
    expect(versionOf(PACK)).toBe("4.10.2");
    expect(versionOf("nonsense")).toBeNull();
  });

  it("asks for a build newer than the pack's, once", () => {
    expect(decide(PACK, BUILD, null)).toMatchObject({
      dispatch: true,
      build: BUILD,
    });
    expect(decide(PACK, PACK, null).dispatch).toBe(false);
    expect(decide(BUILD, PACK, null).dispatch).toBe(false);
    expect(
      decide(PACK, BUILD, { build: BUILD, asked_at: "2026-11-13T15:10:00Z" })
        .dispatch,
    ).toBe(false);
    expect(
      decide(PACK, BUILD, { build: PACK, asked_at: "2026-10-09T08:00:00Z" })
        .dispatch,
    ).toBe(true);
    expect(decide(null, BUILD, null).dispatch).toBe(true);
  });
});
