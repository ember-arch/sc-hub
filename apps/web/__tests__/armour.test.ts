import { readFileSync } from "node:fs";
import type { ItemStats, VehicleStats } from "schema";
import { describe, expect, it } from "vitest";
import {
  afterArmour,
  armourBrief,
  armourInWords,
  armourOf,
  dpsByKindOf,
  shieldsOf,
  times,
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
    expect(armour?.multiplier.physical).toBeCloseTo(0.75);
    expect(armour?.multiplier.energy).toBeCloseTo(0.6);
    expect(armour?.multiplier.distortion).toBe(1);
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
    expect(shieldsOf({ shield_hp: 1200 })).toEqual({
      hp: 1200,
      regen: null,
      faceType: null,
    });
    expect(shieldsOf(null)).toBeNull();
  });

  it("give nothing for the pack's ships without armour or shields", () => {
    const atls = vehicleStats.find((s) => s.class_name === "ARGO_ATLS");
    const roc = vehicleStats.find((s) => s.class_name === "GRIN_ROC");
    expect(atls).toBeDefined();
    expect(roc).toBeDefined();
    expect(armourOf(atls!.raw)).toBeNull();
    expect(shieldsOf(roc!.raw)).toBeNull();
  });

  it("ignore the record's change figures beside each multiplier", () => {
    const armour = armourOf({
      armor: {
        health: 10,
        damage_multiplier: {
          physical: 0.8,
          physical_change: -0.2,
          energy: 1.2,
          distortion: 1,
          thermal: 1,
          biochemical: 1,
          stun: 1,
        },
      },
    });
    expect(armour?.multiplier.physical).toBe(0.8);
    expect(armour?.multiplier.energy).toBe(1.2);
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

  it("gives nothing for a part whose record deals no damage", () => {
    const silent = itemStats.find(
      (s) =>
        typeof s.raw["vehicle_weapon"] === "object" &&
        s.raw["vehicle_weapon"] !== null &&
        dpsByKindOf(s.raw) === null,
    );
    expect(silent).toBeDefined();
  });
});

describe("afterArmour", () => {
  it("multiplies each kind fired by the armour's multiplier for it, and sums", () => {
    const armour = armourOf(gladius.raw)!;
    const out = afterArmour({ energy: 200, physical: 100 }, armour);
    expect(out.kinds).toEqual([
      { kind: "physical", fired: 100, after: 75, multiplier: 0.75 },
      { kind: "energy", fired: 200, after: 120, multiplier: 0.6 },
    ]);
    expect(out.fired).toBe(300);
    expect(out.after).toBe(195);
  });

  it("says the armour in words and in brief, the record's figures only", () => {
    const armour = armourOf(gladius.raw)!;
    expect(armourInWords(armour)).toBe(
      "multiplies physical damage by 0.75 and energy by 0.6; distortion, thermal, biochemical and stun by 1",
    );
    expect(armourBrief(armour)).toBe("Physical ×0.75, energy ×0.6");
    expect(times(1.21)).toBe("×1.21");
    const plain = {
      hp: null,
      multiplier: { ...armour.multiplier, physical: 1, energy: 1 },
    };
    expect(armourBrief(plain)).toBe("Every kind of damage ×1");
    expect(armourInWords(plain)).toBe("multiplies every kind of damage by 1");
  });
});
