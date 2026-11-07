import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { envSchema } from "schema";
import { type DbHandle, createDb } from "../client.js";
import { type Logger, jsonLogger } from "../log.js";

/** `packages/db/.pglite/`, from `src/cli` and from `dist/cli` alike. Git-ignored. */
export const DEFAULT_PGLITE_DIR = fileURLToPath(
  new URL("../../.pglite/", import.meta.url),
);

/** The repository's bootstrap pack, from `src/cli` and from `dist/cli` alike. */
export const DEFAULT_PACK_DIR = fileURLToPath(
  new URL("../../../../fixtures/bootstrap/", import.meta.url),
);

/** DATABASE_URL through the schema's env contract (Zod at the boundary); an empty string is unset. */
export function readDatabaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  const raw = env["DATABASE_URL"];
  return envSchema
    .pick({ DATABASE_URL: true })
    .parse({ DATABASE_URL: raw === "" ? undefined : raw }).DATABASE_URL;
}

/** Postgres when DATABASE_URL is set, else the embedded PGlite database in this package's folder. */
export async function openFromEnv(log: Logger): Promise<DbHandle> {
  const url = readDatabaseUrl();
  if (url !== undefined) {
    log.info({ event: "db.open", driver: "postgres" });
    return createDb({ url });
  }
  log.info({
    event: "db.open",
    driver: "pglite",
    data_dir: DEFAULT_PGLITE_DIR,
    note: "DATABASE_URL is unset, so the embedded database is used",
  });
  return createDb({ dataDir: DEFAULT_PGLITE_DIR });
}

export function newLogger(): Logger {
  return jsonLogger(randomUUID());
}

export function fail(
  log: Logger,
  event: string,
  error: unknown,
  started: number,
): void {
  const details =
    error !== null && typeof error === "object" && "details" in error
      ? (error as { details: unknown }).details
      : undefined;
  log.info({
    event,
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    details,
    duration_ms: Date.now() - started,
  });
  process.exitCode = 1;
}
