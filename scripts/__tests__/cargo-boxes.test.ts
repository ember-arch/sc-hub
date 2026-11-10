import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARGO_ITEMS_PATH,
  CargoItemPage,
  collectBoxes,
  fetchCargoBoxes,
  sizeOf,
} from "../bootstrap-fixtures/cargo-boxes.js";
import { createWikiClient } from "../bootstrap-fixtures/fetch.js";

// ADR-028: the box shapes are read from the wiki's cargo item records; two standard shapes for
// one size halt the run, and a record that is not a standard box is left out and counted.

const sample: unknown = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "fixtures",
      "cargo",
      "samples",
      "items-cargo.sample.json",
    ),
    "utf8",
  ),
);
const VERSION = "4.10.2-LIVE.12881860";

describe("sizeOf", () => {
  it("reads the size from a container's class name and nothing from the rest", () => {
    expect(
      sizeOf("Carryable_TBO_FL_32SCU_Commodity_ProcessedGoods_ProcyonCanister"),
    ).toBe(32);
    expect(
      sizeOf("Carryable_2H_FL_EighthSCU_Commodity_Metal_Agricium"),
    ).toBeNull();
    expect(sizeOf("Cargo_ShipMining_Pod_Mole")).toBeNull();
  });
});

describe("collectBoxes", () => {
  const page = CargoItemPage.parse(sample);

  it("gives one shape per size from the sample and leaves the other build out", () => {
    const { rows, skipped, irregular } = collectBoxes(page.data, VERSION);
    expect(rows.map((b) => b.scu)).toEqual([1, 2, 4, 8, 32]);
    expect(rows[0]).toMatchObject({
      width_m: 1.25,
      height_m: 1.25,
      length_m: 1.25,
    });
    expect(rows.find((b) => b.scu === 32)).toMatchObject({
      width_m: 2.5,
      height_m: 2.5,
      length_m: 10,
    });
    // The record without a size in its name and the 1 SCU twin of another build.
    expect(skipped).toBe(2);
    expect(irregular).toBe(0);
  });

  it("leaves out a record named for a size whose volume is not that size", () => {
    const corpse = {
      ...page.data[0]!,
      class_name: "Carryable_TBO_FL_4SCU_Commodity_Organic_VanduulCorpse",
      dimension: { cargo_dimension: { width: 2, height: 0.65, length: 2.5 } },
    };
    const { rows, irregular } = collectBoxes([...page.data, corpse], VERSION);
    expect(irregular).toBe(1);
    expect(rows.find((b) => b.scu === 4)).toMatchObject({ height_m: 1.25 });
  });

  it("halts on two standard shapes for one size", () => {
    const upended = {
      ...page.data[0]!,
      class_name: "Carryable_TBO_FL_4SCU_Upended",
      dimension: { cargo_dimension: { width: 1.25, height: 2.5, length: 2.5 } },
    };
    expect(() => collectBoxes([...page.data, upended], VERSION)).toThrow(
      /two shapes for a 4 SCU box/,
    );
  });

  it("halts without one agreed 1 SCU cube", () => {
    const noCube = page.data.filter((r) => sizeOf(r.class_name) !== 1);
    expect(() => collectBoxes(noCube, VERSION)).toThrow(/1 SCU cube/);
  });
});

describe("fetchCargoBoxes", () => {
  it("pages through the cargo items and writes a validated fixture", async () => {
    const urls: string[] = [];
    const client = createWikiClient({
      fetch: async (url) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => sample };
      },
      userAgent: "sc-hub-test/0.0",
      sleep: async () => undefined,
    });
    const boxes = await fetchCargoBoxes(
      client,
      VERSION,
      () => "2026-11-10T12:00:00.000Z",
    );
    expect(urls).toEqual([
      `https://api.star-citizen.wiki${CARGO_ITEMS_PATH}&page[number]=1`,
    ]);
    expect(boxes.game_version).toBe(VERSION);
    expect(boxes.rows).toHaveLength(5);
  });
});
