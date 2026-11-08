import { describe, expect, it } from "vitest";
import { catalogRecord, fitsAPort } from "../bootstrap-fixtures/map.js";

// ADR-016: the loadout editor's catalogue keeps parts that fit a port on the pack's ships, each
// with its record trimmed by rule to the fields the site reads.

describe("fitsAPort", () => {
  const ports = [
    { port_type: "weapon" as const, size_min: 3, size_max: 3 },
    { port_type: "missile" as const, size_min: 2, size_max: 3 },
  ];

  it("fits by the port type the wiki type maps to and by size", () => {
    expect(fitsAPort("WeaponGun", 3, ports)).toBe(true);
    expect(fitsAPort("WeaponGun", 4, ports)).toBe(false);
    expect(fitsAPort("Missile", 2, ports)).toBe(true);
    expect(fitsAPort("Shield", 1, ports)).toBe(false);
    expect(fitsAPort("NotAType", 1, ports)).toBe(false);
    expect(fitsAPort("WeaponGun", null, ports)).toBe(false);
  });
});

describe("catalogRecord", () => {
  const raw = {
    uuid: "02a7f68a-5bdd-4887-a256-20c985a65bda",
    name: "10-Series Greatsword Cannon",
    class_name: "KBAR_BallisticCannon_S2",
    type: "WeaponGun",
    sub_type: "Gun",
    size: 2,
    grade: "A",
    class: null,
    version: "4.10.2-LIVE.12881860",
    manufacturer: { name: "KnightBridge Arms", code: "KBAR" },
    description: { en_EN: "Long text" },
    tags: ["a", "b"],
    blueprint: [{ uuid: "x" }],
    durability: { health: 900, resistance: { physical: 1 } },
    vehicle_weapon: {
      type: "Ballistic Cannon",
      rpm: 250,
      range: 2703,
      capacity: 492,
      modes: [{ mode: "Single" }],
      spread: { min: 0.5 },
      damage: {
        burst: 304.1,
        alpha_total: 73,
        max: 35911.1,
        dps: { physical: 304.1 },
      },
    },
    resource_network: {
      is_networked: true,
      states: [
        {
          name: "Online",
          signature: { em: 100 },
          deltas: [
            {
              type: "Consumption",
              resource: "Power",
              rate: 1.3,
              composition: null,
            },
          ],
          power_ranges: [{ start: 0 }],
        },
      ],
    },
  };
  const record = catalogRecord(raw);

  it("keeps identity, maker and the figures the site reads", () => {
    expect(record["class_name"]).toBe("KBAR_BallisticCannon_S2");
    expect(record["manufacturer"]).toEqual({
      name: "KnightBridge Arms",
      code: "KBAR",
    });
    expect(record["durability"]).toEqual({ health: 900 });
    expect(record["vehicle_weapon"]).toEqual({
      type: "Ballistic Cannon",
      capacity: 492,
      range: 2703,
      rpm: 250,
      damage: { burst: 304.1, alpha_total: 73, dps: { physical: 304.1 } },
    });
    expect(record["resource_network"]).toEqual({
      states: [
        {
          name: "Online",
          signature: { em: 100 },
          deltas: [{ type: "Consumption", resource: "Power", rate: 1.3 }],
        },
      ],
    });
  });

  it("drops what the site does not read, and empty fields", () => {
    for (const key of ["description", "tags", "blueprint", "class"])
      expect(record).not.toHaveProperty(key);
    expect(record).not.toHaveProperty("missile");
  });
});
