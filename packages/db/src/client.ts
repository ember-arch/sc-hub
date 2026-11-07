import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  type PgliteDatabase,
  drizzle as drizzlePglite,
} from "drizzle-orm/pglite";
import {
  type PostgresJsDatabase,
  drizzle as drizzlePostgres,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type DbSchema = typeof schema;

/** Any Postgres-dialect Drizzle database or transaction over our schema: what the seed and the tests accept. */
export type Db = PgDatabase<PgQueryResultHKT, DbSchema>;

export type DbHandle =
  | {
      readonly driver: "pglite";
      readonly db: PgliteDatabase<DbSchema>;
      close(): Promise<void>;
    }
  | {
      readonly driver: "postgres";
      readonly db: PostgresJsDatabase<DbSchema>;
      close(): Promise<void>;
    };

export interface CreateDbOptions {
  /** A Postgres connection string (Neon or any Postgres). When set, postgres.js is used. */
  readonly url?: string | undefined;
  /** A directory for an embedded PGlite database. Ignored when `url` is set; omit both for in-memory. */
  readonly dataDir?: string | undefined;
}

/**
 * Opens a database. Tests and local development use PGlite (embedded Postgres, nothing to install);
 * production uses a real Postgres through `DATABASE_URL`. Both return the same shape of handle.
 */
export async function createDb(
  options: CreateDbOptions = {},
): Promise<DbHandle> {
  if (options.url !== undefined && options.url !== "") {
    const client = postgres(options.url, { max: 1, onnotice: () => undefined });
    return {
      driver: "postgres",
      db: drizzlePostgres({ client, schema }),
      close: async () => {
        await client.end();
      },
    };
  }
  const client =
    options.dataDir === undefined ? new PGlite() : new PGlite(options.dataDir);
  await client.waitReady;
  return {
    driver: "pglite",
    db: drizzlePglite({ client, schema }),
    close: () => client.close(),
  };
}
