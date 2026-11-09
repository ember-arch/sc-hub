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

  it("has no paints until the pipeline publishes them", () => {
    for (const ship of r.ships) expect(ship.paints).toEqual([]);
  });

  it("lists an edition under its base, never as an entry (ADR-022)", () => {
    // The pack's editions: same name and maker as their base, class name extended.
    const editions = r.ships.filter((s) => s.editionOf !== null);
    for (const e of editions) {
      expect(e.editionOf?.name).toBe(e.vehicle.name);
      expect(
        e.vehicle.class_name.startsWith(`${e.editionOf?.class_name}_`),
      ).toBe(true);
      expect(r.entries).not.toContain(e);
      expect(r.editionsOf(e.editionOf!.class_name)).toContain(e);
      expect(
        r.searchEntries.filter((x) => x.href === `/ships/${e.vehicle.slug}`),
      ).toEqual([]);
      expect(r.lineup(e.vehicle.manufacturer_code)).not.toContain(e);
    }
    expect(r.entries.length + editions.length).toBe(r.ships.length);
    // Every entry name is listed once per maker.
    const seen = new Set<string>();
    for (const s of r.entries) {
      const key = `${s.vehicle.manufacturer_code}|${s.vehicle.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
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
  // A plain entry: not an edition, and no edition points at it (ADR-022).
  const base = pack.rows.Vehicle.find(
    (v) =>
      v.base_variant_of === null &&
      !pack.rows.Vehicle.some((o) => o.base_variant_of === v.class_name),
  );
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

  it("keeps a variant with a name of its own as an entry", () => {
    const view = r.shipBySlug(variant.slug);
    expect(view?.editionOf).toBeNull();
    expect(r.entries).toContain(view);
  });

  it("folds a same-name edition under its base", () => {
    const edition = Vehicle.parse({
      ...base,
      class_name: `${base.class_name}_Display`,
      slug: `${base.slug}-display`,
      base_variant_of: base.class_name,
    });
    const folded = buildRepository(
      {
        manifest: extended.manifest,
        rows: {
          ...extended.rows,
          Vehicle: [...extended.rows.Vehicle, edition],
        },
      },
      [],
    );
    const view = folded.shipBySlug(edition.slug);
    expect(view?.editionOf?.class_name).toBe(base.class_name);
    expect(view?.label).toBe(`${base.name} (${edition.class_name})`);
    expect(folded.entries.map((s) => s.vehicle.slug)).not.toContain(
      edition.slug,
    );
    expect(
      folded.editionsOf(base.class_name).map((s) => s.vehicle.class_name),
    ).toEqual([edition.class_name]);
    // A chain (a showroom copy of the edition) resolves to the root entry.
    const copy = Vehicle.parse({
      ...edition,
      class_name: `${edition.class_name}_Copy`,
      slug: `${edition.slug}-copy`,
      base_variant_of: edition.class_name,
    });
    const chained = buildRepository(
      {
        manifest: extended.manifest,
        rows: {
          ...extended.rows,
          Vehicle: [...extended.rows.Vehicle, edition, copy],
        },
      },
      [],
    );
    expect(chained.shipBySlug(copy.slug)?.editionOf?.class_name).toBe(
      base.class_name,
    );
    expect(
      chained.editionsOf(base.class_name).map((s) => s.vehicle.class_name),
    ).toEqual([edition.class_name, copy.class_name]);
    // A part is credited to the ship whose ports carry it; the copied row has no ports.
    const stock = folded
      .shipPorts(base.class_name)
      .find((p) => p.item !== null);
    if (stock?.item != null) {
      const names = folded
        .stockOn(stock.item.class_name)
        .map((s) => s.vehicle.slug);
      expect(names).toContain(base.slug);
      expect(names).not.toContain(edition.slug);
    }
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
