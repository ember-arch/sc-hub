import { readFileSync } from "node:fs";
import type { ItemStats, VehicleStats } from "schema";
import { describe, expect, it } from "vitest";
import { alphaByKindOf, damagePath, mitigationOf } from "../lib/damage-path";

const packDir = new URL("../../../fixtures/bootstrap/", import.meta.url);
const read = <T>(name: string): T[] =>
  JSON.parse(readFileSync(new URL(name, packDir), "utf8")) as T[];
const vehicleStats = read<VehicleStats>("VehicleStats.json");
const itemStats = read<ItemStats>("ItemStats.json");
const gladius = vehicleStats.find((s) => s.class_name === "AEGS_Gladius")!;

describe("mitigationOf", () => {
  it("reads the Gladius's shield shares, deflection, armour durability, hull and component figures", () => {
    const m = mitigationOf(gladius.raw)!;
    expect(m.shieldAbsorption?.physical).toEqual({ min: 0, max: 0.45 });
    expect(m.shieldAbsorption?.energy).toEqual({ min: 1, max: 1 });
    expect(m.shieldResistance?.physical).toEqual({ min: 0, max: 0.25 });
    expect(m.shieldResistance?.distortion).toEqual({ min: 0.75, max: 0.95 });
    expect(m.deflection?.physical).toBe(11);
    expect(m.deflection?.energy).toBe(9);
    expect(m.armourDurability?.physical).toBeCloseTo(0.81);
    expect(m.armourDurability?.energy).toBeCloseTo(1.21);
    expect(m.hull.physical).toBeCloseTo(0.75);
    expect(m.components).toBeCloseTo(0.4);
  });

  it("has no shield shares for a ship without shields, and nothing for a ship without armour", () => {
    const roc = vehicleStats.find((s) => s.class_name === "GRIN_ROC")!;
    const m = mitigationOf(roc.raw);
    expect(m).not.toBeNull();
    expect(m?.shieldAbsorption).toBeNull();
    const atls = vehicleStats.find((s) => s.class_name === "ARGO_ATLS")!;
    expect(mitigationOf(atls.raw)).toBeNull();
  });

  it("every ship with shields has the same shield shares CIG published (ballistic absorption 45%)", () => {
    const withShields = vehicleStats
      .map((s) => mitigationOf(s.raw))
      .filter((m) => m !== null && m.shieldAbsorption !== null);
    expect(withShields.length).toBeGreaterThan(200);
    for (const m of withShields) {
      expect(m!.shieldAbsorption!.physical.max).toBeCloseTo(0.45);
      expect(m!.shieldAbsorption!.energy.max).toBe(1);
    }
  });
});

describe("alphaByKindOf", () => {
  it("reads a gun's damage per shot by kind", () => {
    const gatling = itemStats.find(
      (s) => s.class_name === "GATS_BallisticGatling_S3",
    )!;
    expect(alphaByKindOf(gatling.raw)).toEqual({ physical: 32 });
  });
});

describe("damagePath", () => {
  const m = mitigationOf(gladius.raw)!;

  it("with shields up, the shields absorb their share less their resistance, the rest passes", () => {
    const [p] = damagePath({ physical: 100 }, m, true);
    expect(p).toMatchObject({ kind: "physical", shot: 100 });
    // 45% absorbed, of which the shields resist 25%: 33.75 to the shields; 55 passes.
    expect(p!.shields).toBeCloseTo(33.75);
    expect(p!.passed).toBeCloseTo(55);
    expect(p!.armour).toBeCloseTo(55 * 0.81);
    expect(p!.hull).toBeCloseTo(55 * 0.75);
    expect(p!.components).toBeCloseTo(55 * 0.4);
    expect(p!.belowDeflection).toBeNull();
  });

  it("energy is absorbed whole while the shields are up; with them down everything passes", () => {
    const [up] = damagePath({ energy: 200 }, m, true);
    expect(up!.shields).toBeCloseTo(200);
    expect(up!.passed).toBe(0);
    expect(up!.hull).toBe(0);
    const [down] = damagePath({ energy: 200 }, m, false);
    expect(down!.shields).toBe(0);
    expect(down!.passed).toBe(200);
    expect(down!.armour).toBeCloseTo(242);
    expect(down!.hull).toBeCloseTo(120);
  });

  it("names the deflection figure beside a shot that falls below it, and applies it to nothing", () => {
    const [p] = damagePath({ energy: 5 }, m, false);
    expect(p!.belowDeflection).toBe(9);
    expect(p!.hull).toBeCloseTo(3);
    const [big] = damagePath({ energy: 50 }, m, false);
    expect(big!.belowDeflection).toBeNull();
  });
});
