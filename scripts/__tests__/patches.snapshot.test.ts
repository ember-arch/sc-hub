import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PatchSnapshot,
  PatchSnapshotFile,
  decodeSnapshot,
  encodeSnapshot,
} from "schema";
import { describe, expect, it } from "vitest";
import {
  flatten,
  isPlaceholder,
  mapBlueprint,
  mapPart,
  mapShip,
  renderSnapshot,
} from "../patches/snapshot.js";

// The patch snapshots' mapping (ADR-049), on cut answers of the Star Citizen Wiki API for
// 4.10.2-LIVE.12881860 (fixtures/patches/samples, read on 2026-11-11). No test reaches the network.

const samples = join(
  import.meta.dirname,
  "..",
  "..",
  "fixtures",
  "patches",
  "samples",
);
const read = (name: string) =>
  JSON.parse(readFileSync(join(samples, name), "utf8")) as {
    data: Record<string, unknown> | Record<string, unknown>[];
  };

const vehicle = read("vehicle-record.sample.json").data as Record<
  string,
  unknown
>;
const items = read("items-page.sample.json").data as Record<string, unknown>[];
const blueprints = read("blueprints-page.sample.json").data as Record<
  string,
  unknown
>[];

describe("flatten", () => {
  it("keeps numbers, flags and short strings by path, and drops lists, ids and the long", () => {
    expect(
      flatten(
        {
          a: { b: 1, uuid: "x", c: [1, 2], d: "Infrared", e: "x".repeat(81) },
          max: 2,
          maximum: 2,
          link: "https://example.org",
          f: true,
          g: null,
        },
        "",
      ),
    ).toEqual({ "a.b": 1, "a.d": "Infrared", max: 2, f: true });
  });
});

describe("mapShip", () => {
  const ship = mapShip(vehicle);

  it("keeps the ship's figures as the record states them", () => {
    expect(ship.name).toBe("Gladius");
    expect(ship.game_name).toBe("Aegis Gladius");
    expect(ship.manufacturer).toBe("AEGS");
    expect(ship.figures["speed.scm"]).toBe(
      (vehicle["speed"] as { scm: number }).scm,
    );
    expect(ship.figures["health"]).toBe(vehicle["health"]);
    expect(ship.figures["armor.health"]).toBeTypeOf("number");
  });

  it("drops the figures the record states twice or works out from the fitted parts", () => {
    const keys = Object.keys(ship.figures);
    expect(keys.some((k) => /^armor\.damage_physical$/.test(k))).toBe(false);
    expect(keys.some((k) => k.startsWith("armor.damage_multipliers."))).toBe(
      false,
    );
    expect(keys.some((k) => k.includes("_grouped."))).toBe(false);
    expect(keys.some((k) => k.startsWith("shield.resistance."))).toBe(false);
    expect(keys).toContain("armor.damage_multiplier.physical");
  });

  it("records the part fitted at each port that carries one, nested ports by path", () => {
    const ports = Object.keys(ship.loadout);
    expect(ports.length).toBeGreaterThan(0);
    // A gun inside a gimbal is keyed by both port names.
    expect(ports.some((p) => p.includes("/"))).toBe(true);
    // Seat access and other fittings are not parts.
    expect(ports.some((p) => p.includes("seat_access"))).toBe(false);
  });
});

describe("mapPart", () => {
  it("keeps a gun's, a missile's and a shield's own figures and the power network by state", () => {
    const [gun, missile, shield] = items.map(mapPart);
    expect(gun?.type).toBe("WeaponGun");
    expect(gun?.figures["vehicle_weapon.damage.burst"]).toBeTypeOf("number");
    expect(
      Object.keys(gun?.figures ?? {}).some((k) =>
        k.startsWith("resource_network.states.Online.Power."),
      ),
    ).toBe(true);
    expect(
      Object.keys(gun?.figures ?? {}).some((k) => k.startsWith("dimension.")),
    ).toBe(false);
    expect(
      missile?.figures["missile.damage_total"] ??
        missile?.figures["missile.speed"],
    ).toBeDefined();
    expect(shield?.figures["shield.max_health"]).toBeTypeOf("number");
    expect(gun?.size).toBe(items[0]?.["size"]);
  });
});

describe("mapBlueprint", () => {
  it("keeps craft time and each ingredient in SCU or by count", () => {
    const bp = mapBlueprint(blueprints[0]!);
    expect(bp.output_name).toBe(blueprints[0]?.["output_name"]);
    expect(bp.figures["craft_time_seconds"]).toBe(
      blueprints[0]?.["craft_time_seconds"],
    );
    const units = new Set(Object.values(bp.ingredients).map((i) => i.unit));
    expect([...units].every((u) => u === "SCU" || u === "each")).toBe(true);
  });

  it("halts on a blueprint that names no output (the fetch leaves such placeholders out first)", () => {
    const temp = blueprints.find((b) => !b["output_name"]);
    expect(temp).toBeDefined();
    expect(() => mapBlueprint(temp!)).toThrow(/names no output/);
  });
});

describe("the file", () => {
  const snapshot = PatchSnapshot.parse({
    schema_version: 2,
    game_version: "4.10.2-LIVE.12881860",
    channel: "LIVE",
    released_at: "2026-10-09T00:00:00.000Z",
    fetched_at: "2026-11-11T00:00:00.000Z",
    source: "wiki-api",
    source_url: "https://api.star-citizen.wiki",
    counts: { ships: 1, parts: items.length, blueprints: 2 },
    ships: { AEGS_Gladius: mapShip(vehicle) },
    unrecorded_ships: ["AEGS_Gladius_Example"],
    parts: Object.fromEntries(
      items.map((r) => [String(r["class_name"]), mapPart(r)]),
    ),
    blueprints: Object.fromEntries(
      blueprints
        .filter((b) => b["output_name"])
        .map((b) => [String(b["key"]), mapBlueprint(b)]),
    ),
  });

  it("reads back exactly what it wrote", () => {
    const file = PatchSnapshotFile.parse(
      JSON.parse(
        renderSnapshot(PatchSnapshotFile.parse(encodeSnapshot(snapshot))),
      ),
    );
    expect(decodeSnapshot(file)).toEqual(snapshot);
  });

  it("writes one record per line, so a new build's file reviews as a list", () => {
    const text = renderSnapshot(encodeSnapshot(snapshot));
    expect(
      text.split("\n").filter((l) => l.startsWith('    "AEGS_Gladius": {')),
    ).toHaveLength(1);
  });

  it("knows the wiki's placeholders", () => {
    expect(isPlaceholder("<= PLACEHOLDER =>")).toBe(true);
    expect(isPlaceholder("Gladius")).toBe(false);
  });
});
