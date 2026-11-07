import { runMigrations } from "../migrate.js";
import { fail, newLogger, openFromEnv } from "./common.js";

// `pnpm db:migrate`: apply every unapplied migration, forward-only, and print one summary line.

const log = newLogger();
const started = Date.now();

async function main(): Promise<void> {
  const handle = await openFromEnv(log);
  try {
    const { applied } = await runMigrations(handle);
    process.stdout.write(
      `${JSON.stringify({
        event: "db.migrate.summary",
        run_id: log.run_id,
        driver: handle.driver,
        applied,
        errors: 0,
        duration_ms: Date.now() - started,
      })}\n`,
    );
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) =>
  fail(log, "db.migrate.failed", error, started),
);
