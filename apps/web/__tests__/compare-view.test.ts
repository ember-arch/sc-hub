import { describe, expect, it } from "vitest";
import { pricesFor } from "../lib/acquisition";
import { compareColumns, compareGroups } from "../lib/compare-view";
import { buildRepository } from "../lib/data";
import { VEHICLE_STATS } from "../lib/views";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Compare": the key-facts set and the full stats table, one column per ship,
// with rows every ship lacks omitted. Checked over the fixture pack.

const r = buildRepository(bootstrapPack(), []);
const ships = r.ships.slice(0, 3);

describe("compareColumns", () => {
  it("links each ship and removes only that ship from the comparison", () => {
    const columns = compareColumns(ships);
    expect(columns.map((c) => c.slug)).toEqual(
      ships.map((s) => s.vehicle.slug),
    );
    for (const column of columns) {
      expect(column.href).toBe(`/ships/${column.slug}`);
      const rest = ships
        .map((s) => s.vehicle.slug)
        .filter((slug) => slug !== column.slug);
      expect(column.removeHref).toBe(`/compare?ships=${rest.join(",")}`);
    }
  });
});

describe("compareGroups", () => {
  const groups = compareGroups(ships);

  it("puts the key-facts set first, with manufacturer and status since compare has no hero", () => {
    expect(groups[0]?.title).toBe("Key facts");
    expect(groups[0]?.rows.map((row) => row.label)).toEqual([
      "Manufacturer",
      "Role",
      "Size",
      "Crew",
      "Cargo",
      "Length",
      "Mass",
      "Status",
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Key facts",
      "Acquisition",
      "Specifications",
    ]);
  });

  it("shows each ship's headline prices from fixtures/acquisition (ADR-013)", () => {
    const acquisition = groups.find((g) => g.title === "Acquisition");
    const pledge = acquisition?.rows.find((row) => row.key === "pledge");
    expect(pledge?.unit).toBe("USD");
    expect(pledge?.values).toEqual(
      ships.map(
        (s) =>
          pricesFor(s.vehicle.slug, s.vehicle.class_name).pledge?.price_usd ??
          null,
      ),
    );
  });

  it("covers every VehicleStats field exactly once across the groups", () => {
    const keys = groups.flatMap((g) => g.rows.map((row) => row.key));
    const stats = new Set(VEHICLE_STATS.map((spec) => spec.key as string));
    const lackedByAll = new Set(
      VEHICLE_STATS.filter((spec) =>
        ships.every((s) => (s.stats?.[spec.key] ?? null) === null),
      ).map((spec) => spec.key as string),
    );
    for (const key of stats) {
      const shown = keys.includes(key) || keys.includes(keyFactFor(key));
      expect(shown, `${key} shown`).toBe(!lackedByAll.has(key));
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("omits a row every ship lacks and keeps one some ship has", () => {
    // The bootstrap pack has no hydrogen_fuel for any ship, so that row is gone.
    const labels = groups.flatMap((g) => g.rows.map((row) => row.label));
    const fuel = VEHICLE_STATS.find((spec) => spec.key === "hydrogen_fuel");
    if (ships.every((s) => (s.stats?.hydrogen_fuel ?? null) === null)) {
      expect(labels).not.toContain(fuel?.label);
    }
    for (const row of groups.flatMap((g) => g.rows)) {
      expect(row.values).toHaveLength(ships.length);
      expect(row.values.some((v) => v !== null)).toBe(true);
    }
  });

  it("carries units and digits from the ship page's field table", () => {
    const byKey = new Map(
      VEHICLE_STATS.map((spec) => [spec.key as string, spec]),
    );
    const specs = groups.find((g) => g.title === "Specifications");
    for (const row of specs?.rows ?? []) {
      const spec = byKey.get(row.key);
      expect(spec, row.key).toBeDefined();
      expect(row.unit).toBe(spec?.unit);
      expect(row.digits).toBe(spec?.digits);
    }
  });
});

/** Key facts use their own row keys for the three stats they cover. */
function keyFactFor(statKey: string): string {
  return (
    { cargo_scu: "cargo", length_m: "length", mass_kg: "mass" }[statKey] ??
    statKey
  );
}
