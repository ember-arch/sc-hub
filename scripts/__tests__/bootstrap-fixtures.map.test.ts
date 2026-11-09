import { readFileSync } from "node:fs";
import type {
  Channel,
  Item,
  ItemStats,
  Port,
  Vehicle,
  VehicleStats,
} from "schema";
import { describe, expect, it } from "vitest";
import {
  MapError,
  TYPE_EXCLUDE,
  TYPE_MAP,
  TYPE_OTHER,
  VEHICLE_RAW_DROP,
  assignSlugs,
  classifyType,
  collapseLocales,
  en,
  isComponentType,
  mapChannel,
  mapItem,
  mapItemStats,
  mapKind,
  mapPorts,
  mapSizeClass,
  mapStatus,
  mapVehicle,
  mapVehicleStats,
  pruneRaw,
  slugify,
} from "../bootstrap-fixtures/map.js";
import { WikiItem, WikiVehicle } from "../bootstrap-fixtures/types.js";

// The mapper is tested on the raw samples the script wrote next to the pack. Mapping a sample must
// reproduce rows that are in the committed pack, which also catches any hand edit to either side.

const packDir = new URL("../../fixtures/bootstrap/", import.meta.url);
const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(name, packDir), "utf8"));
const manifest = readJson("manifest.json") as {
  channel: Channel;
  game_version: string;
};
const { channel, game_version: version } = manifest;
const committed = <T>(entity: string): T[] => readJson(`${entity}.json`) as T[];

const vehicleSample = WikiVehicle.parse(readJson("samples/vehicle.json"));
const itemSamples = ["weapon", "shield", "quantum-drive"].map((kind) =>
  WikiItem.parse(readJson(`samples/item-${kind}.json`)),
);

describe("vocabulary tables", () => {
  it("classify every known type string as map, other or exclude", () => {
    for (const [type, portType] of Object.entries(TYPE_MAP)) {
      expect(classifyType(type)).toEqual({ outcome: "map", portType });
    }
    for (const type of TYPE_OTHER) {
      expect(classifyType(type)).toEqual({ outcome: "other" });
    }
    for (const type of [...TYPE_EXCLUDE, "WeaponController", "SeatAccess"]) {
      expect(classifyType(type)).toEqual({ outcome: "exclude" });
    }
    expect(classifyType("Hyperdrive")).toEqual({ outcome: "unknown" });
  });

  it("treat only ItemType members other than `other` as components", () => {
    expect(isComponentType("weapon")).toBe(true);
    expect(isComponentType("thruster")).toBe(true);
    expect(isComponentType("other")).toBe(false);
    expect(isComponentType("paint")).toBe(false);
    expect(isComponentType("interior")).toBe(false);
  });

  it("map channel strings and halt on an unknown one", () => {
    expect(mapChannel("live")).toBe("LIVE");
    expect(mapChannel("PTU")).toBe("PTU");
    expect(() => mapChannel("beta")).toThrow(MapError);
  });

  it("map status, size and kind from the vehicle and halt outside the tables", () => {
    const base = vehicleSample;
    expect(mapStatus({ ...base, production_status: "Flight-Ready" })).toBe(
      "flight_ready",
    );
    expect(
      mapStatus({ ...base, production_status: { en_EN: "In-Production" } }),
    ).toBe("in_production");
    expect(() => mapStatus({ ...base, production_status: "Rumoured" })).toThrow(
      MapError,
    );
    expect(mapSizeClass({ ...base, size: { en_EN: "Capital" } })).toBe(
      "capital",
    );
    // The wiki writes the literal "undefined" where the game files class no size (ADR-022).
    expect(mapSizeClass({ ...base, size: { en_EN: "undefined" } })).toBeNull();
    expect(() => mapSizeClass({ ...base, size: 2 })).toThrow(MapError);
    expect(() => mapSizeClass({ ...base, size: "Enormous" })).toThrow(MapError);
    expect(mapKind({ ...base, is_spaceship: true })).toBe("ship");
    expect(mapKind({ ...base, is_spaceship: false, is_vehicle: true })).toBe(
      "ground_vehicle",
    );
    expect(() =>
      mapKind({
        ...base,
        is_spaceship: false,
        is_vehicle: false,
        is_gravlev: null,
      }),
    ).toThrow(MapError);
  });
});

describe("helpers", () => {
  it("en() returns English text or null", () => {
    expect(en("Gladius")).toBe("Gladius");
    expect(en({ en_EN: "Small", de_DE: "Klein" })).toBe("Small");
    expect(en({ de_DE: "Klein" })).toBe(null);
    expect(en(2)).toBe(null);
    expect(en(null)).toBe(null);
  });

  it("collapseLocales keeps English only, recursively", () => {
    expect(
      collapseLocales({
        a: { en_EN: "x", de_DE: "y" },
        b: [{ en_EN: "z" }],
        c: { d: 1, e: null },
      }),
    ).toEqual({ a: "x", b: ["z"], c: { d: 1, e: null } });
  });

  it("pruneRaw drops the listed keys and collapses the rest", () => {
    expect(
      pruneRaw(
        { ports: [1], shops: [], mass: 1, foci: [{ en_EN: "F" }] },
        VEHICLE_RAW_DROP,
      ),
    ).toEqual({ mass: 1, foci: ["F"] });
  });

  it("slugify is kebab-case of the display name", () => {
    expect(slugify("P-52 Merlin")).toBe("p-52-merlin");
    expect(slugify("Cutlass Black")).toBe("cutlass-black");
    expect(slugify("  Mantis GT-220 Gatling ")).toBe("mantis-gt-220-gatling");
    expect(slugify("<= PLACEHOLDER =>")).toBe("placeholder");
  });

  it("assignSlugs: name, then manufacturer prefix, then class_name, then halt", () => {
    const slugs = assignSlugs([
      {
        class_name: "AEGS_Eclipse",
        name: "Eclipse",
        manufacturer_code: "AEGS",
      },
      { class_name: "RSI_Eclipse", name: "Eclipse", manufacturer_code: "RSI" },
      {
        class_name: "AEGS_Gladius",
        name: "Gladius",
        manufacturer_code: "AEGS",
      },
      {
        class_name: "AEGS_Thruster_Main",
        name: "Placeholder",
        manufacturer_code: "UNKN",
      },
      {
        class_name: "AEGS_Thruster_Mav",
        name: "Placeholder",
        manufacturer_code: "UNKN",
      },
    ]);
    expect(slugs.get("AEGS_Eclipse")).toBe("aegs-eclipse");
    expect(slugs.get("RSI_Eclipse")).toBe("rsi-eclipse");
    expect(slugs.get("AEGS_Gladius")).toBe("gladius");
    expect(slugs.get("AEGS_Thruster_Main")).toBe("aegs-thruster-main");
    expect(slugs.get("AEGS_Thruster_Mav")).toBe("aegs-thruster-mav");
    expect(() =>
      assignSlugs([{ class_name: "A_1", name: "???", manufacturer_code: "A" }]),
    ).toThrow(MapError);
    expect(() =>
      assignSlugs([
        { class_name: "A_X", name: "Same", manufacturer_code: "A" },
        { class_name: "A-X", name: "Same", manufacturer_code: "A" },
      ]),
    ).toThrow(MapError);
  });
});

describe("mapping the vehicle sample", () => {
  const vehicles = committed<Vehicle>("Vehicle");
  const stats = committed<VehicleStats>("VehicleStats");
  const ports = committed<Port>("Port");
  const expectedVehicle = vehicles.find(
    (v) => v.class_name === vehicleSample.class_name,
  );

  it("reproduces the committed Vehicle and VehicleStats rows", () => {
    if (expectedVehicle === undefined) throw new Error("sample not in pack");
    expect(mapVehicle(vehicleSample, expectedVehicle.slug, version)).toEqual(
      expectedVehicle,
    );
    expect(mapVehicleStats(vehicleSample, channel, version)).toEqual(
      stats.find((s) => s.class_name === vehicleSample.class_name),
    );
  });

  it("reproduces committed Port rows, with nesting and no unknown types", () => {
    const mapped = mapPorts(vehicleSample, channel, version);
    expect(mapped.unknown.size).toBe(0);
    expect(mapped.ports.length).toBeGreaterThan(0);
    const byPath = new Map(
      ports
        .filter((p) => p.class_name === vehicleSample.class_name)
        .map((p) => [p.port_path, p]),
    );
    for (const port of mapped.ports) {
      expect(byPath.get(port.port_path), port.port_path).toEqual(port);
    }
    expect(mapped.ports.some((p) => p.parent_port_path !== null)).toBe(true);
    for (const port of mapped.ports) {
      const expectedPath =
        port.parent_port_path === null
          ? port.port_name
          : `${port.parent_port_path}/${port.port_name}`;
      expect(port.port_path).toBe(expectedPath);
    }
    for (const className of mapped.stockItems.keys()) {
      expect(mapped.ports.some((p) => p.default_item_class === className)).toBe(
        true,
      );
    }
  });

  it("leaves out an unnamed dummy port, and halts if one carries a part (ADR-022)", () => {
    const [first] = vehicleSample.ports ?? [];
    if (first === undefined) throw new Error("sample has no ports");
    const empty = mapPorts(
      {
        ...vehicleSample,
        ports: [{ ...first, name: "", equipped_item: null }],
      },
      channel,
      version,
    );
    expect(empty.ports).toEqual([]);
    expect(empty.excluded.get("unnamed")).toBe(1);
    expect(() =>
      mapPorts(
        {
          ...vehicleSample,
          ports: [
            {
              ...first,
              name: "",
              equipped_item: first.equipped_item ?? {
                class_name: "TEST_Part",
                name: "Test part",
                type: "WeaponGun",
                uuid: "00000000-0000-0000-0000-000000000000",
              },
            },
          ],
        },
        channel,
        version,
      ),
    ).toThrow(MapError);
  });

  it("accepts a missing port version and halts on a different one", () => {
    const [first] = vehicleSample.ports ?? [];
    if (first === undefined) throw new Error("sample has no ports");
    const withoutVersion = {
      ...vehicleSample,
      ports: [{ ...first, version: null }],
    };
    expect(() => mapPorts(withoutVersion, channel, version)).not.toThrow();
    const different = {
      ...vehicleSample,
      ports: [{ ...first, version: "0.0.0-TEST.1" }],
    };
    expect(() => mapPorts(different, channel, version)).toThrow(MapError);
    expect(() =>
      mapVehicle({ ...vehicleSample, version: "0.0.0-TEST.1" }, "x", version),
    ).toThrow(MapError);
  });

  it("halts when a required stat is missing instead of defaulting it", () => {
    expect(() =>
      mapVehicleStats({ ...vehicleSample, mass: null }, channel, version),
    ).toThrow(/mass/);
    expect(() =>
      mapVehicleStats(
        { ...vehicleSample, crew: { min: 1, max: null } },
        channel,
        version,
      ),
    ).toThrow(/crew\.max/);
  });

  it("collects unknown port types instead of guessing", () => {
    const mapped = mapPorts(
      {
        ...vehicleSample,
        ports: [
          { name: "hp_a", type: "Hyperdrive", sizes: { min: 1, max: 1 } },
          { name: "hp_b", type: "Shield", sizes: { min: 1, max: 1 } },
        ],
      },
      channel,
      version,
    );
    expect([...mapped.unknown]).toEqual(["Hyperdrive"]);
    expect(mapped.ports.map((p) => p.port_name)).toEqual(["hp_b"]);
  });

  it("allows the same port name under different parents and halts on a repeated path", () => {
    const child = {
      name: "missile_01_attach",
      type: "Missile",
      sizes: { min: 2, max: 2 },
    };
    const twoRacks = {
      ...vehicleSample,
      ports: [
        {
          name: "rack_left",
          type: "MissileLauncher",
          sizes: { min: 3, max: 3 },
          ports: [child],
        },
        {
          name: "rack_right",
          type: "MissileLauncher",
          sizes: { min: 3, max: 3 },
          ports: [child],
        },
      ],
    };
    const mapped = mapPorts(twoRacks, channel, version);
    expect(mapped.ports.map((p) => p.port_path).sort()).toEqual([
      "rack_left",
      "rack_left/missile_01_attach",
      "rack_right",
      "rack_right/missile_01_attach",
    ]);
    const [first] = vehicleSample.ports ?? [];
    if (first === undefined) throw new Error("sample has no ports");
    expect(() =>
      mapPorts(
        { ...vehicleSample, ports: [first, { ...first, ports: null }] },
        channel,
        version,
      ),
    ).toThrow(/appears twice/);
  });

  it("gives `other` and non-component ports no stock item", () => {
    const mapped = mapPorts(
      {
        ...vehicleSample,
        ports: [
          {
            name: "hp_paint",
            type: "Paints",
            sizes: { min: 0, max: 0 },
            equipped_item: {
              uuid: "u",
              name: "Paint",
              class_name: "PAINT_X",
              type: "Paints",
            },
          },
        ],
      },
      channel,
      version,
    );
    expect(mapped.ports[0]?.default_item_class).toBe(null);
    expect(mapped.stockItems.size).toBe(0);
  });
});

describe("mapping the item samples", () => {
  const items = committed<Item>("Item");
  const stats = committed<ItemStats>("ItemStats");

  it.each(itemSamples.map((sample) => [sample.class_name, sample] as const))(
    "reproduces the committed rows for %s",
    (className, sample) => {
      const expected = items.find((i) => i.class_name === className);
      if (expected === undefined) throw new Error("sample not in pack");
      expect(mapItem(sample, expected.slug, version)).toEqual(expected);
      expect(mapItemStats(sample, channel, version)).toEqual(
        stats.find((s) => s.class_name === className),
      );
    },
  );

  it("fills the type-specific fields the sample kind has and leaves the rest null", () => {
    const [weapon, shield, quantumDrive] = itemSamples.map((sample) =>
      mapItemStats(sample, channel, version),
    );
    expect(weapon?.weapon_damage).not.toBe(null);
    expect(weapon?.shield_hp).toBe(null);
    expect(shield?.shield_hp).not.toBe(null);
    expect(shield?.qd_speed).toBe(null);
    expect(quantumDrive?.qd_speed).not.toBe(null);
    expect(quantumDrive?.weapon_damage).toBe(null);
  });

  it("refuses an item whose type is not a component kind", () => {
    const [sample] = itemSamples;
    if (sample === undefined) throw new Error("no item sample");
    expect(() => mapItem({ ...sample, type: "Paints" }, "x", version)).toThrow(
      MapError,
    );
    expect(() =>
      mapItem({ ...sample, type: "Hyperdrive" }, "x", version),
    ).toThrow(MapError);
  });

  it("keeps the raw remainder free of shops, images and non-English text", () => {
    for (const sample of itemSamples) {
      const raw = mapItemStats(sample, channel, version).raw;
      expect(Object.keys(raw)).not.toContain("shops");
      expect(Object.keys(raw)).not.toContain("images");
      expect(JSON.stringify(raw)).not.toContain("de_DE");
    }
  });
});
