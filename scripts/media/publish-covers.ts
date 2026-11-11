/**
 * Publishes the covers of new Comm-Links to the media store from the News workflow (ADR-051): only
 * the covers the live manifest lacks for Comm-Links of the last fortnight, merged into the live
 * manifest without touching anything else (`cover-publish.ts`). Adds a row per new cover to
 * `fixtures/rsi-media/cover-sources.json`, whose commit to main redeploys the site, which then
 * builds from the new manifest.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/media/publish-covers.ts [options]
 *
 *   --dry-run                plan only: read the live manifest and RSI, build the renditions,
 *                            merge and check; upload nothing, write nothing
 *   --dry-run-without-token  a dry run when no credentials are set, a real run otherwise (the
 *                            workflow's mode, so the step is harmless before the secret exists)
 *   --rehearse <id,...>      a dry run as if these Comm-Links had no cover yet: the whole path on
 *                            covers already up, whose planned keys should be the live ones
 *   --pages <n>              hub pages to read at most (default 3)
 *   --recent-days <n>        how far back a Comm-Link without a cover is looked for (default 14)
 *
 * Credentials as `publish.ts` reads them (`blob-env.ts`): BLOB_READ_WRITE_TOKEN, a GitHub Actions
 * secret in the workflow. CDN_BASE_URL is the store's public address (not a secret). RSI requests
 * need SC_HUB_CONTACT_EMAIL (CLAUDE.md section 9). No credential appears in anything printed.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envSchema } from "schema/env";
import { z } from "zod";
import { vercelBlobStore } from "./blob.js";
import { loadBlobSettings } from "./blob-env.js";
import { encodeCoverRenditions } from "./cover-renditions.js";
import { HUB_PAGES, RECENT_DAYS, publishCovers } from "./cover-publish.js";
import { CoverSource } from "./sources.js";
import { rsiUserAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const newsFile = join(repoRoot, "fixtures", "news", "ContentItem.json");
const sourcesPath = join(
  repoRoot,
  "fixtures",
  "rsi-media",
  "cover-sources.json",
);

interface Options {
  dryRun: boolean;
  dryRunWithoutToken: boolean;
  rehearse: string[];
  pages: number;
  recentDays: number;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    dryRun: false,
    dryRunWithoutToken: false,
    rehearse: [],
    pages: HUB_PAGES,
    recentDays: RECENT_DAYS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    const whole = (value: string): number => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`${arg} needs a positive whole number`);
      }
      return n;
    };
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--dry-run-without-token")
      options.dryRunWithoutToken = true;
    else if (arg === "--rehearse") {
      // Empty is allowed, so the workflow can pass its optional input through as it is.
      options.rehearse = next()
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      if (options.rehearse.some((id) => !/^\d+$/.test(id))) {
        throw new Error("--rehearse takes Comm-Link ids, digits only");
      }
    } else if (arg === "--pages") options.pages = whole(next());
    else if (arg === "--recent-days") options.recentDays = whole(next());
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const options = parseArgs(process.argv.slice(2));
  const log = (fields: Record<string, unknown>): void =>
    console.error(
      JSON.stringify({ run_id: runId, job: "media:publish-covers", ...fields }),
    );

  const settings = loadBlobSettings(repoRoot);
  const hasCredentials = !("missing" in settings);
  if (!hasCredentials && !options.dryRun && !options.dryRunWithoutToken) {
    throw new Error(
      `no credentials: ${settings.missing}; or run with --dry-run`,
    );
  }
  const rawCdn = process.env["CDN_BASE_URL"];
  const cdn =
    rawCdn === undefined || rawCdn === ""
      ? undefined
      : envSchema.shape.CDN_BASE_URL.parse(rawCdn);
  const cdnBaseUrl = cdn?.replace(/\/+$/, "") ?? null;
  // A rehearsal never writes, credentials or not.
  const dryRun =
    options.dryRun || !hasCredentials || options.rehearse.length > 0;

  const result = await publishCovers(
    {
      fetch,
      store: hasCredentials ? vercelBlobStore(settings.auth) : null,
      cdnBaseUrl,
      encode: encodeCoverRenditions,
      userAgent: () => rsiUserAgent("media"),
      now: Date.now,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      newsRows: JSON.parse(readFileSync(newsFile, "utf8")) as unknown,
      coverSources: existsSync(sourcesPath)
        ? z
            .array(CoverSource)
            .parse(JSON.parse(readFileSync(sourcesPath, "utf8")))
        : [],
      log,
    },
    {
      dryRun,
      pages: options.pages,
      recentDays: options.recentDays,
      rehearse: options.rehearse,
      cdnWaitMs: 6 * 60 * 1000,
      cdnPollMs: 20 * 1000,
    },
  );
  if (!dryRun && result.coverSources !== null) {
    writeFileSync(
      sourcesPath,
      `${JSON.stringify(result.coverSources, null, 2)}\n`,
    );
  }

  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:publish-covers",
      dry_run: dryRun,
      credentials: hasCredentials
        ? "token" in settings.auth
          ? "read-write token"
          : "OIDC"
        : "none",
      recent_days: options.recentDays,
      on_record: result.onRecord,
      candidates: result.candidates,
      hub_pages: result.hubPages,
      not_on_hub: result.notOnHub,
      planned: result.planned,
      ...(result.rehearsal === null ? {} : { rehearsal: result.rehearsal }),
      uploaded: result.uploaded,
      already_there: result.alreadyThere,
      manifest: result.manifest,
      manifest_attempts: result.attempts,
      manifest_generated_at: result.generatedAt,
      before: result.before,
      after: result.after,
      cover_sources_written: !dryRun && result.coverSources !== null,
      cdn: result.cdn,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify({
      job: "media:publish-covers",
      error: error instanceof Error ? error.message : String(error),
      errors: 1,
    }),
  );
  process.exitCode = 1;
}
