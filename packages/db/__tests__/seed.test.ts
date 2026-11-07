import { randomUUID } from "node:crypto";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import {
  type DataPack,
  type EntityName,
  type PackRows,
  entityNames,
} from "schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../src/client.js";
import { silentLogger } from "../src/log.js";
import { loadPack } from "../src/pack.js";
import {
  gameVersion,
  item,
  manufacturer,
  port,
  tables,
  vehicle,
  vehicleStats,
} from "../src/schema/index.js";
import { SeedDriftError, seedPack } from "../src/seed.js";
import { BOOTSTRAP_PACK, HOOK_TIMEOUT, openMigrated } from "./helpers.js";

// The seed is exercised end to end on the committed bootstrap pack, in memory.

function partialPack(base: DataPack, rows: Partial<PackRows>): DataPack {
  const empty = Object.fromEntries(
    entityNames.map((entity) => [entity, []]),
  ) as unknown as PackRows;
  return { manifest: base.manifest, rows: { ...empty, ...rows } };
}

const byKey = <T>(rows: T[], key: (row: T) => string): T[] =>
  [...rows].sort((a, b) => key(a).localeCompare(key(b)));

/** Drizzle wraps driver errors ("Failed query: ..."); the constraint text is on the cause. */
const mentions =
  (pattern: RegExp) =>
  (error: unknown): boolean => {
    const cause = (error as { cause?: unknown }).cause;
    const text = [error, cause]
      .map((e) => (e instanceof Error ? e.message : String(e ?? "")))
      .join(" ");
    return pattern.test(text);
  };

describe("seedPack with the bootstrap pack", () => {
  let handle: DbHandle;
  let pack: DataPack;
  const log = silentLogger();

  beforeAll(async () => {
    pack = loadPack(BOOTSTRAP_PACK);
    handle = await openMigrated();
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    await handle.close();
  });

  it(
    "inserts every row of the pack",
    async () => {
      const result = await seedPack(handle.db, pack, log);
      for (const entity of entityNames) {
        const expected = pack.rows[entity].length;
        expect(result.counts[entity], entity).toEqual({
          in: expected,
          inserted: expected,
          updated: 0,
          unchanged: 0,
        });
        const [row] = await handle.db
          .select({ n: count() })
          .from(tables[entity]);
        expect(row?.n, `${entity} rows in the database`).toBe(expected);
      }
    },
    HOOK_TIMEOUT,
  );

  it("joins every stock item to an item row", async () => {
    const [orphans] = await handle.db
      .select({ n: count() })
      .from(port)
      .leftJoin(item, eq(port.default_item_class, item.class_name))
      .where(and(isNotNull(port.default_item_class), isNull(item.class_name)));
    expect(orphans?.n).toBe(0);
  });

  it("holds exactly one current version per channel", async () => {
    const current = await handle.db
      .select()
      .from(gameVersion)
      .where(eq(gameVersion.is_current, true));
    expect(current).toHaveLength(1);
  });

  it("round-trips timestamps, doubles, arrays and jsonb exactly", async () => {
    const [stored] = await handle.db.select().from(gameVersion);
    expect(stored).toEqual(pack.rows.GameVersion[0]);

    const vehicles = await handle.db.select().from(vehicle);
    expect(byKey(vehicles, (v) => v.class_name)).toEqual(
      byKey(pack.rows.Vehicle, (v) => v.class_name),
    );

    const stats = await handle.db.select().from(vehicleStats);
    expect(byKey(stats, (s) => s.class_name)).toEqual(
      byKey(pack.rows.VehicleStats, (s) => s.class_name),
    );
  });

  it(
    "is a no-op when the same pack is seeded again",
    async () => {
      const again = await seedPack(handle.db, pack, log);
      for (const entity of entityNames) {
        const n = pack.rows[entity].length;
        expect(again.counts[entity], entity).toEqual({
          in: n,
          inserted: 0,
          updated: 0,
          unchanged: n,
        });
      }
    },
    HOOK_TIMEOUT,
  );

  it("updates mutable identity attributes but never the slug", async () => {
    const original = pack.rows.Vehicle[0];
    if (original === undefined) throw new Error("pack has no vehicles");
    const changed = { ...original, role: "Changed role", slug: "changed-slug" };
    const result = await seedPack(
      handle.db,
      partialPack(pack, { Vehicle: [changed] }),
      log,
    );
    expect(result.counts.Vehicle).toEqual({
      in: 1,
      inserted: 0,
      updated: 1,
      unchanged: 0,
    });
    const [stored] = await handle.db
      .select()
      .from(vehicle)
      .where(eq(vehicle.class_name, original.class_name));
    expect(stored?.role).toBe("Changed role");
    expect(stored?.slug).toBe(original.slug);

    // Put it back so later assertions see the pack's values.
    await seedPack(handle.db, partialPack(pack, { Vehicle: [original] }), log);
  });

  it("rolls the whole run back when a versioned row differs", async () => {
    const stats = pack.rows.VehicleStats[0];
    const maker = pack.rows.Manufacturer[0];
    if (stats === undefined || maker === undefined) {
      throw new Error("pack is missing rows");
    }
    const drifted = { ...stats, mass_kg: stats.mass_kg + 1 };
    const renamed = { ...maker, name: `${maker.name} (renamed)` };
    await expect(
      seedPack(
        handle.db,
        partialPack(pack, { Manufacturer: [renamed], VehicleStats: [drifted] }),
        log,
      ),
    ).rejects.toBeInstanceOf(SeedDriftError);

    const [storedMaker] = await handle.db
      .select()
      .from(manufacturer)
      .where(eq(manufacturer.code, maker.code));
    expect(storedMaker?.name).toBe(maker.name);
    const [storedStats] = await handle.db
      .select()
      .from(vehicleStats)
      .where(eq(vehicleStats.class_name, stats.class_name));
    expect(storedStats?.mass_kg).toBe(stats.mass_kg);
  });

  it("rejects a second current version for the same channel", async () => {
    const current = pack.rows.GameVersion[0];
    if (current === undefined) throw new Error("pack has no game version");
    await expect(
      handle.db.insert(gameVersion).values({
        ...current,
        id: randomUUID(),
        version: "0.0.0-TEST.1",
      }),
    ).rejects.toSatisfy(mentions(/unique|duplicate/i));
  });

  it("rejects a stat row for a version the database does not know", async () => {
    const stats = pack.rows.VehicleStats[0];
    if (stats === undefined) throw new Error("pack has no stats");
    await expect(
      handle.db
        .insert(vehicleStats)
        .values({ ...stats, game_version: "0.0.0-TEST.1" }),
    ).rejects.toSatisfy(mentions(/foreign key/i));
  });

  it("rejects a stat row for a vehicle the database does not know", async () => {
    const stats = pack.rows.VehicleStats[0];
    if (stats === undefined) throw new Error("pack has no stats");
    await expect(
      handle.db
        .insert(vehicleStats)
        .values({ ...stats, class_name: "TEST_Missing" }),
    ).rejects.toSatisfy(mentions(/foreign key/i));
  });

  it("keeps the seed order stable for every entity", () => {
    const seeded: EntityName[] = [];
    for (const entity of entityNames) seeded.push(entity);
    expect(seeded).toHaveLength(12);
  });
});
