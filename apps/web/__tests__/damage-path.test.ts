import { readFileSync } from "node:fs";
import type { ItemStats, VehicleStats } from "schema";
import { describe, expect, it } from "vitest";
import { shieldsOf } from "../lib/armour";
import {
  alphaByKindOf,
  damagePath,
  hasShieldShares,
  mitigationOf,
  perSecondToHull,
} from "../lib/damage-path";

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

  it("every shielded ship with shield shares has the ones CIG published (ballistic absorption 45%); fifteen ground vehicles have none", () => {
    const shielded = vehicleStats
      .map((s) => ({ s, m: mitigationOf(s.raw) }))
      .filter(({ s, m }) => m !== null && shieldsOf(s.raw) !== null);
    const withShares = shielded.filter(({ m }) => hasShieldShares(m!));
    const without = shielded.filter(({ m }) => !hasShieldShares(m!));
    expect(withShares.length).toBeGreaterThan(200);
    expect(without.length).toBe(15);
    for (const { m } of withShares) {
      expect(m!.shieldAbsorption!.physical.max).toBeCloseTo(0.45);
      expect(m!.shieldAbsorption!.energy.max).toBe(1);
    }
    expect(without.map(({ s }) => s.class_name)).toContain("RSI_Lynx");
  });
});

describe("alphaByKindOf", () => {
  it("reads a gun's damage per shot by kind, and nothing for a part without one", () => {
    const gatling = itemStats.find(
      (s) => s.class_name === "GATS_BallisticGatling_S3",
    )!;
    expect(alphaByKindOf(gatling.raw)).toEqual({ physical: 32 });
    expect(alphaByKindOf({})).toBeNull();
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

  it("with shields down, physical passes whole and the shields take nothing", () => {
    const [p] = damagePath({ physical: 100 }, m, false);
    expect(p!.shields).toBe(0);
    expect(p!.passed).toBe(100);
    expect(p!.hull).toBeCloseTo(75);
  });

  it("gives a ship with shields but no shares a path that starts at the armour", () => {
    const lynx = vehicleStats.find((s) => s.class_name === "RSI_Lynx")!;
    const lm = mitigationOf(lynx.raw)!;
    expect(hasShieldShares(lm)).toBe(false);
    const [p] = damagePath({ physical: 100 }, lm, true);
    expect(p!.shields).toBe(0);
    expect(p!.passed).toBe(100);
  });

  it("gives the hull's damage per second at the rate of fire, on the same figures", () => {
    const [p] = damagePath({ physical: 32 }, m, true);
    // 853 per second × 55% passing × 0.75 to the hull.
    expect(perSecondToHull(853, p!, m)).toBeCloseTo(853 * 0.55 * 0.75);
  });

  it("names the deflection figure beside a shot that falls below it, and applies it to nothing", () => {
    const [p] = damagePath({ energy: 5 }, m, false);
    expect(p!.belowDeflection).toBe(9);
    expect(p!.hull).toBeCloseTo(3);
    const [big] = damagePath({ energy: 50 }, m, false);
    expect(big!.belowDeflection).toBeNull();
  });
});
