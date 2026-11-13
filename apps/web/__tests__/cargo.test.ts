import { readFileSync } from "node:fs";
import { type CargoBox, CargoBoxes, type VehicleStats } from "schema";
import { describe, expect, it } from "vitest";
import {
  cargoGridsOf,
  cellOf,
  fitOf,
  gridTakes,
  groupGrids,
  largestBox,
  scuHeld,
} from "../lib/cargo";

// ADR-028: the grids come from the vehicle's record, the box shapes from the cargo items' records;
// the count is boxes of one size in rows, nothing more.

const root = new URL("../../../fixtures/", import.meta.url);
const vehicleStats = JSON.parse(
  readFileSync(new URL("bootstrap/VehicleStats.json", root), "utf8"),
) as VehicleStats[];
const boxes = CargoBoxes.parse(
  JSON.parse(readFileSync(new URL("cargo/CargoBox.json", root), "utf8")),
);
const box = (scu: number): CargoBox => boxes.rows.find((b) => b.scu === scu)!;
const stats = (className: string): VehicleStats =>
  vehicleStats.find((s) => s.class_name === className)!;

describe("cargoGridsOf", () => {
  it("reads the Cutlass Black's two grids from its record", () => {
    const grids = cargoGridsOf(stats("DRAK_Cutlass_Black").raw);
    expect(grids).toEqual([
      {
        width: 5,
        height: 2.5,
        length: 6.25,
        scu: 40,
        external: false,
        minBox: null,
        maxBox: 2,
      },
      {
        width: 1.25,
        height: 2.5,
        length: 3.75,
        scu: 6,
        external: false,
        minBox: null,
        maxBox: 1,
      },
    ]);
    expect(cellOf(grids![0]!)).toBeCloseTo(1.25, 6);
  });

  it("gives an empty list for a fighter and null for a record without a grid list", () => {
    expect(cargoGridsOf(stats("AEGS_Gladius").raw)).toEqual([]);
    expect(cargoGridsOf({})).toBeNull();
    expect(cargoGridsOf({ cargo_grids: [{ width: 5, scu: 40 }] })).toEqual([]);
  });

  it("sums to the record's cargo figure on every ship with grids", () => {
    let haulers = 0;
    for (const s of vehicleStats) {
      const grids = cargoGridsOf(s.raw) ?? [];
      if (grids.length === 0 || s.cargo_scu === null) continue;
      haulers += 1;
      expect(grids.reduce((a, g) => a + g.scu, 0)).toBeCloseTo(s.cargo_scu, 2);
    }
    expect(haulers).toBeGreaterThan(50);
  });

  it("keeps what the record does not say as not said: open to space, the largest box", () => {
    // A record of the kind the old Hammerhead's was until 4.10.3, which retired that class name:
    // its grid says neither whether it is open to space nor its largest box.
    const silent = cargoGridsOf({
      cargo_grids: [{ width: 10, height: 10, length: 10, scu: 512 }],
    })!;
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((g) => g.external === null)).toBe(true);
    expect(silent.every((g) => g.maxBox === null)).toBe(true);
    // Such a grid admits every size, and the page says the record names no largest box.
    expect(gridTakes(silent[0]!, box(32))).toBe(true);
    expect(largestBox(silent)).toBeNull();
    expect(
      cargoGridsOf({
        cargo_grids: [
          { width: 2.5, height: 2.5, length: 2.5, scu: 8, external: false },
        ],
      }),
    ).toEqual([
      {
        width: 2.5,
        height: 2.5,
        length: 2.5,
        scu: 8,
        external: false,
        minBox: null,
        maxBox: null,
      },
    ]);
  });

  it("honours a smallest box where the record names one", () => {
    const mpuv = cargoGridsOf(stats("ARGO_MPUV_1T").raw)!;
    expect(mpuv[0]).toMatchObject({ minBox: 16, maxBox: 16 });
    expect(gridTakes(mpuv[0]!, box(8))).toBe(false);
    expect(fitOf(mpuv[0]!, box(8)).count).toBe(0);
    expect(fitOf(mpuv[0]!, box(16)).count).toBe(1);
  });
});

describe("groupGrids and largestBox", () => {
  it("draw the Carrack's nine grids as two groups, largest first", () => {
    const grids = cargoGridsOf(stats("ANVL_Carrack").raw)!;
    const groups = groupGrids(grids);
    expect(groups.map((g) => [g.grid.scu, g.count])).toEqual([
      [64, 6],
      [24, 3],
    ]);
    expect(largestBox(grids)).toBe(16);
  });
});

describe("fitOf", () => {
  const cutlass = cargoGridsOf(stats("DRAK_Cutlass_Black").raw)!;

  it("fills the Cutlass Black's main grid with 2 SCU boxes turned across, 20 in all", () => {
    expect(fitOf(cutlass[0]!, box(2))).toEqual({
      across: 2,
      along: 5,
      layers: 2,
      count: 20,
      turned: true,
    });
    expect(fitOf(cutlass[0]!, box(1)).count).toBe(40);
  });

  it("refuses a box the record says the grid does not take", () => {
    expect(gridTakes(cutlass[0]!, box(4))).toBe(false);
    expect(fitOf(cutlass[0]!, box(4)).count).toBe(0);
    expect(fitOf(cutlass[1]!, box(2)).count).toBe(0);
  });

  it("stacks 16 SCU boxes two deep in the Carrack's 64 SCU grids", () => {
    const carrack = groupGrids(cargoGridsOf(stats("ANVL_Carrack").raw)!);
    const fit = fitOf(carrack[0]!.grid, box(16));
    expect(fit.count).toBe(4);
    expect(fit.layers).toBe(2);
    // The three 24 SCU grids (5 × 3.75 × 2.5 m) each stand one 16 SCU box, turned.
    expect(fitOf(carrack[1]!.grid, box(16))).toMatchObject({
      count: 1,
      turned: true,
    });
    expect(scuHeld(carrack, box(16))).toBe(6 * 4 * 16 + 3 * 1 * 16);
  });

  it("never holds more SCU than the grid", () => {
    for (const s of vehicleStats) {
      for (const g of cargoGridsOf(s.raw) ?? []) {
        for (const b of boxes.rows) {
          expect(fitOf(g, b).count * b.scu).toBeLessThanOrEqual(g.scu + 1e-6);
        }
      }
    }
  });
});
