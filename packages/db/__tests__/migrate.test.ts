import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DbHandle, createDb } from "../src/client.js";
import {
  countAppliedMigrations,
  migrationsFolder,
  runMigrations,
} from "../src/migrate.js";
import { HOOK_TIMEOUT, rawRows } from "./helpers.js";

describe("migrations", () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = await createDb();
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    await handle.close();
  });

  it("has exactly one migration, named 0001_init, with no DROP in it", () => {
    const files = readdirSync(migrationsFolder).filter((f) =>
      f.endsWith(".sql"),
    );
    expect(files).toEqual(["0001_init.sql"]);
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((entry) => entry.tag)).toEqual(["0001_init"]);
    const text = readFileSync(join(migrationsFolder, "0001_init.sql"), "utf8");
    expect(text.toUpperCase()).not.toContain("DROP ");
  });

  it(
    "applies once and is a no-op the second time",
    async () => {
      expect(await countAppliedMigrations(handle.db)).toBe(0);
      expect((await runMigrations(handle)).applied).toBe(1);
      expect((await runMigrations(handle)).applied).toBe(0);
      expect(await countAppliedMigrations(handle.db)).toBe(1);
    },
    HOOK_TIMEOUT,
  );

  it("creates the 12 tables, the 8 enum types and the one-current-per-channel index", async () => {
    const tables = await rawRows<{ table_name: string }>(
      handle,
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(tables.map((row) => row.table_name)).toEqual([
      "author",
      "content_item",
      "entity_link",
      "game_version",
      "item",
      "item_stats",
      "manufacturer",
      "model",
      "paint",
      "port",
      "vehicle",
      "vehicle_stats",
    ]);

    const enums = await rawRows<{ typname: string }>(
      handle,
      sql`select typname from pg_type where typtype = 'e' order by typname`,
    );
    expect(enums.map((row) => row.typname)).toEqual([
      "channel",
      "content_source",
      "entity_type",
      "item_type",
      "model_tier",
      "port_type",
      "vehicle_kind",
      "vehicle_status",
    ]);

    const indexes = await rawRows<{ indexdef: string }>(
      handle,
      sql`select indexdef from pg_indexes where indexname = 'game_version_one_current_per_channel'`,
    );
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.indexdef).toMatch(/UNIQUE/);
    expect(indexes[0]?.indexdef).toMatch(/WHERE/);
  });
});
