import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { runMigrations } from "../migrate.js";
import { loadPack } from "../pack.js";
import { seedPack } from "../seed.js";
import { DEFAULT_PACK_DIR, fail, newLogger, openFromEnv } from "./common.js";

// `pnpm db:seed [--pack <dir>]`: migrate, validate the pack, load it in one transaction, and print
// one summary line. Defaults to fixtures/bootstrap.

const log = newLogger();
const started = Date.now();

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { pack: { type: "string" } },
    strict: true,
  });
  const packDir =
    values.pack === undefined ? DEFAULT_PACK_DIR : resolve(values.pack);

  // Validation runs before the database is touched, so a bad pack writes nothing.
  const pack = loadPack(packDir);
  log.info({
    event: "db.seed.pack",
    pack: packDir,
    channel: pack.manifest.channel,
    game_version: pack.manifest.game_version,
    files: pack.manifest.files.length,
  });

  const handle = await openFromEnv(log);
  try {
    const { applied } = await runMigrations(handle);
    const result = await seedPack(handle.db, pack, log);
    process.stdout.write(
      `${JSON.stringify({
        event: "db.seed.summary",
        run_id: log.run_id,
        driver: handle.driver,
        pack: packDir,
        channel: pack.manifest.channel,
        game_version: pack.manifest.game_version,
        migrations_applied: applied,
        counts: result.counts,
        errors: 0,
        duration_ms: Date.now() - started,
      })}\n`,
    );
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => fail(log, "db.seed.failed", error, started));
