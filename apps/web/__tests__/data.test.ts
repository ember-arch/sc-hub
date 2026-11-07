import { randomUUID } from "node:crypto";
import {
  GameVersion,
  Paint,
  Vehicle,
  VehicleStats,
  type DataPack,
} from "schema";
import { describe, expect, it } from "vitest";
import { buildRepository } from "../lib/data";
import { bootstrapPack } from "./pack";

// The repository over the fixture pack, plus a copy of the pack with rows the bootstrap has none
// of (a PTU build, a variant, paints) so the ship page's sections are covered before the pipeline
// produces them. The extra rows are copies of fixture rows with identity fields changed; every
// one still validates against the schema.

const pack = bootstrapPack();

describe("buildRepository on the fixture pack", () => {
  const r = buildRepository(pack, []);

  it("exposes the current LIVE build and no PTU build", () => {
    expect(r.liveVersion).toBe(pack.manifest.game_version);
    expect(r.ptuVersion).toBeNull();
    for (const ship of r.ships) expect(ship.ptu).toBeNull();
    for (const c of r.components) expect(c.ptu).toBeNull();
  });

  it("sorts ships and components by name and resolves slugs", () => {
    const names = r.ships.map((s) => s.vehicle.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    const first = r.ships[0];
    if (first === undefined) throw new Error("empty pack");
    expect(r.shipBySlug(first.vehicle.slug)).toBe(first);
    expect(r.shipBySlug("no-such-ship")).toBeUndefined();
  });

  it("has no variants or paints until the pipeline publishes them", () => {
    for (const ship of r.ships) {
      expect(r.variantsOf(ship.vehicle.class_name)).toEqual([]);
      expect(ship.paints).toEqual([]);
    }
  });

  it("links stock items both ways", () => {
    const withItem = r.ships.find((s) =>
      r.shipPorts(s.vehicle.class_name).some((p) => p.item !== null),
    );
    if (withItem === undefined) throw new Error("no stock loadout in pack");
    const node = r
      .shipPorts(withItem.vehicle.class_name)
      .find((p) => p.item !== null);
    if (node === undefined || node.item === null)
      throw new Error("unreachable");
    expect(r.stockOn(node.item.class_name)).toContain(withItem);
  });
});

/** The pack with a current PTU build (one ship changed), one variant and two paints added. */
function extendedPack(): {
  pack: DataPack;
  base: Vehicle;
  variant: Vehicle;
  ptuVersion: string;
} {
  const base = pack.rows.Vehicle[0];
  const stats = pack.rows.VehicleStats.find(
    (s) => s.class_name === base?.class_name,
  );
  if (base === undefined || stats === undefined)
    throw new Error("pack has no ship with stats");
  const ptuVersion = `${pack.manifest.game_version}-ptu-test`;
  const ptuBuild = GameVersion.parse({
    ...pack.rows.GameVersion[0],
    id: randomUUID(),
    channel: "PTU",
    version: ptuVersion,
  });
  const ptuStats = VehicleStats.parse({
    ...stats,
    channel: "PTU",
    game_version: ptuVersion,
    mass_kg: stats.mass_kg + 1,
  });
  const variant = Vehicle.parse({
    ...base,
    class_name: `${base.class_name}_Test`,
    slug: `${base.slug}-test-variant`,
    name: `${base.name} test variant`,
    base_variant_of: base.class_name,
  });
  const paints = ["Test paint B", "Test paint A"].map((name) =>
    Paint.parse({
      id: randomUUID(),
      class_name: base.class_name,
      name,
      preview_asset: null,
    }),
  );
  return {
    pack: {
      manifest: pack.manifest,
      rows: {
        ...pack.rows,
        GameVersion: [...pack.rows.GameVersion, ptuBuild],
        VehicleStats: [...pack.rows.VehicleStats, ptuStats],
        Vehicle: [...pack.rows.Vehicle, variant],
        Paint: [...pack.rows.Paint, ...paints],
      },
    },
    base,
    variant,
    ptuVersion,
  };
}

describe("buildRepository with PTU, variant and paint rows", () => {
  const { pack: extended, base, variant, ptuVersion } = extendedPack();
  const r = buildRepository(extended, []);

  it("exposes the PTU build and the PTU row for the ship that has one", () => {
    expect(r.ptuVersion).toBe(ptuVersion);
    expect(r.versions).toContainEqual({ channel: "PTU", version: ptuVersion });
    const ship = r.shipBySlug(base.slug);
    expect(ship?.ptu?.game_version).toBe(ptuVersion);
    expect(ship?.stats?.channel).toBe("LIVE");
    const other = r.ships.find((s) => s.vehicle.class_name !== base.class_name);
    expect(other?.ptu).toBeNull();
  });

  it("groups a variant with its base, excluding the ship itself", () => {
    expect(
      r.variantsOf(base.class_name).map((s) => s.vehicle.class_name),
    ).toEqual([variant.class_name]);
    expect(
      r.variantsOf(variant.class_name).map((s) => s.vehicle.class_name),
    ).toEqual([base.class_name]);
  });

  it("lists a ship's paints sorted by name", () => {
    expect(r.shipBySlug(base.slug)?.paints.map((p) => p.name)).toEqual([
      "Test paint A",
      "Test paint B",
    ]);
    expect(r.shipBySlug(variant.slug)?.paints).toEqual([]);
  });
});
