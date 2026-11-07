import type { SQL } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { type DbHandle, createDb } from "../src/client.js";
import { runMigrations } from "../src/migrate.js";

/** Cold PGlite start on CI can take a while; every hook that opens one uses this. */
export const HOOK_TIMEOUT = 30_000;

/** The repository's bootstrap pack. Unit tests run on files in fixtures/, never on the network. */
export const BOOTSTRAP_PACK = fileURLToPath(
  new URL("../../../fixtures/bootstrap/", import.meta.url),
);

/** A fresh in-memory database with every migration applied. */
export async function openMigrated(): Promise<DbHandle> {
  const handle = await createDb();
  await runMigrations(handle);
  return handle;
}

/** Raw rows from a query; tests always run on PGlite, whose results expose `rows`. */
export async function rawRows<T extends Record<string, unknown>>(
  handle: DbHandle,
  query: SQL,
): Promise<T[]> {
  if (handle.driver !== "pglite") {
    throw new Error("unit tests run on PGlite only");
  }
  const result = await handle.db.execute<T>(query);
  return result.rows as unknown as T[];
}
