import { count } from "drizzle-orm";
import { bigint, pgSchema, serial, text } from "drizzle-orm/pg-core";
import { fileURLToPath } from "node:url";
import type { Db, DbHandle } from "./client.js";

/** `../migrations/` resolves the same from `src/` and from `dist/`, which is why this package has a `src/` folder. */
export const migrationsFolder = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

// Drizzle's own bookkeeping table. Declared here, outside src/schema, so drizzle-kit never
// generates it and the seed never touches it.
const drizzleSchema = pgSchema("drizzle");
const migrationsTable = drizzleSchema.table("__drizzle_migrations", {
  id: serial().primaryKey(),
  hash: text().notNull(),
  created_at: bigint({ mode: "number" }),
});

/** Applied migrations so far; 0 before the first run, when the bookkeeping table does not exist. */
export async function countAppliedMigrations(db: Db): Promise<number> {
  try {
    const [row] = await db.select({ count: count() }).from(migrationsTable);
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Applies every migration in `migrations/` that the database has not seen. Forward-only and
 * idempotent: a second run applies nothing. Picks the migrator that matches the driver.
 */
export async function runMigrations(
  handle: DbHandle,
): Promise<{ applied: number }> {
  const before = await countAppliedMigrations(handle.db);
  switch (handle.driver) {
    case "pglite": {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(handle.db, { migrationsFolder });
      break;
    }
    case "postgres": {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(handle.db, { migrationsFolder });
      break;
    }
  }
  const after = await countAppliedMigrations(handle.db);
  return { applied: after - before };
}
