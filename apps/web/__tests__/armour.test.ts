import { readFileSync } from "node:fs";
import type { ItemStats, VehicleStats } from "schema";
import { describe, expect, it } from "vitest";
import {
  armourInWords,
  armourOf,
  dpsByKindOf,
  shieldsOf,
  throughArmour,
} from "../lib/armour";

const packDir = new URL("../../../fixtures/bootstrap/", import.meta.url);
const read = <T>(name: string): T[] =>
  JSON.parse(readFileSync(new URL(name, packDir), "utf8")) as T[];
const vehicleStats = read<VehicleStats>("VehicleStats.json");
const itemStats = read<ItemStats>("ItemStats.json");
const gladius = vehicleStats.find((s) => s.class_name === "AEGS_Gladius")!;

describe("armourOf and shieldsOf", () => {
  it("read the Gladius's armour and shields from its record", () => {
    const armour = armourOf(gladius.raw);
    expect(armour).not.toBeNull();
    expect(armour?.taken.physical).toBeCloseTo(0.75);
    expect(armour?.taken.energy).toBeCloseTo(0.6);
    expect(armour?.taken.distortion).toBe(1);
    expect(armour?.hp).toBe(3300);
    const shields = shieldsOf(gladius.raw);
    expect(shields).toEqual({ hp: 6336, regen: 1204, faceType: "Bubble" });
  });

  it("give nothing for a record without them, never a guess", () => {
    expect(armourOf({})).toBeNull();
    expect(
      armourOf({ armor: { damage_multiplier: { physical: 0.8 } } }),
    ).toBeNull();
    expect(shieldsOf({ shield_hp: 0 })).toBeNull();
    expect(shieldsOf(null)).toBeNull();
  });

  it("read armour for nearly every ship in the pack, and shields for those with any", () => {
    const withArmour = vehicleStats.filter((s) => armourOf(s.raw) !== null);
    expect(withArmour.length).toBeGreaterThan(vehicleStats.length * 0.9);
    const withShields = vehicleStats.filter((s) => shieldsOf(s.raw) !== null);
    expect(withShields.length).toBeGreaterThan(vehicleStats.length * 0.8);
  });
});

describe("dpsByKindOf", () => {
  it("reads a gun's damage per second by kind and skips kinds it does not deal", () => {
    const scattergun = itemStats.find(
      (s) => s.class_name === "AMRS_AAgun_CC_S3",
    )!;
    expect(dpsByKindOf(scattergun.raw)).toEqual({ energy: 277.3 });
    expect(dpsByKindOf({})).toBeNull();
  });
});

describe("throughArmour", () => {
  it("multiplies each kind fired by the share the armour lets through, and sums", () => {
    const armour = armourOf(gladius.raw)!;
    const out = throughArmour({ energy: 200, physical: 100 }, armour);
    expect(out.kinds).toEqual([
      { kind: "physical", fired: 100, reaching: 75, taken: 0.75 },
      { kind: "energy", fired: 200, reaching: 120, taken: 0.6 },
    ]);
    expect(out.fired).toBe(300);
    expect(out.reaching).toBe(195);
  });

  it("says the armour in words", () => {
    expect(armourInWords(armourOf(gladius.raw)!)).toBe(
      "takes 75% of physical and 60% of energy damage, distortion, thermal, biochemical and stun in full",
    );
  });
});
