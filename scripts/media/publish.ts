/**
 * Publishes the built media to the Vercel Blob store behind the CDN (ADR-034): everything
 * `prepare.ts` wrote to `apps/web/public/media/`, manifest included. Run by hand on the owner's
 * machine, where the complete media lives; never from CI, which has no media.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/media/publish.ts [options]
 *
 *   --media <dir>     the built media folder (default apps/web/public/media)
 *   --dry-run         plan and list only; upload nothing (plans without credentials too)
 *   --prune           delete objects the new manifest no longer names (default: count them);
 *                     refused in a run that changed the manifest, since the live site still
 *                     names the old keys until its next build
 *   --concurrency <n> parallel uploads (default 8)
 *   --allow-cover-drop let the new manifest lack Comm-Link covers the live one has; refused
 *                     otherwise, since the News workflow adds covers to the live manifest that a
 *                     checkout may not have yet (ADR-051): run fetch-covers.ts and prepare.ts first
 *
 * Credentials come from `.env.local` (then `.env`) at the repository root, never from arguments:
 * either BLOB_READ_WRITE_TOKEN, or VERCEL_OIDC_TOKEN with BLOB_STORE_ID (what `vercel env pull`
 * writes). CDN_BASE_URL, when set, is read back through at the end. The summary line names the
 * store's public address, which is not a secret; no token appears in anything this prints.
 *
 * Every file goes up under a content-addressed key (`publish-plan.ts`) cached for a year, so a run
 * uploads only what the store lacks and never changes a key's bytes; the manifest, rewritten to
 * those keys, goes up last with a five-minute TTL (`publish-sync.ts`). The run ends by reading the
 * manifest back through the CDN and asking it for one picture with an `Origin`, as a browser would,
 * and says what it saw.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { MediaManifest } from "schema";
import { vercelBlobStore } from "./blob.js";
import { loadBlobSettings } from "./blob-env.js";
import { type LocalFile, MANIFEST_KEY, planPublish } from "./publish-plan.js";
import { syncToStore } from "./publish-sync.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

interface Options {
  mediaDir: string;
  dryRun: boolean;
  prune: boolean;
  allowCoverDrop: boolean;
  concurrency: number;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    mediaDir: join(repoRoot, "apps", "web", "public", "media"),
    dryRun: false,
    prune: false,
    allowCoverDrop: false,
    concurrency: 8,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === "--media") options.mediaDir = next();
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--prune") options.prune = true;
    else if (arg === "--allow-cover-drop") options.allowCoverDrop = true;
    else if (arg === "--concurrency") options.concurrency = Number(next());
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency needs a positive whole number");
  }
  return options;
}

const sha256File = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

/** Every file under the media folder as the manifest names it, with its hash and size. */
async function scanMedia(mediaDir: string): Promise<LocalFile[]> {
  const out: LocalFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      out.push({
        src: `/media/${relative(mediaDir, path).split("\\").join("/")}`,
        sha256: await sha256File(path),
        bytes: statSync(path).size,
      });
    }
  };
  await walk(mediaDir);
  return out;
}

/** Reads the manifest back through the CDN and asks for one object with CORS, as a browser would. */
async function checkCdn(
  cdnBaseUrl: string,
  generatedAt: string,
  sampleKey: string | null,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    const response = await fetch(`${cdnBaseUrl}/${MANIFEST_KEY}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      out["manifest"] = `HTTP ${response.status}`;
    } else {
      const remote = MediaManifest.parse(await response.json());
      out["manifest"] =
        remote.generated_at === generatedAt
          ? "current"
          : `previous (${remote.generated_at}); the CDN may hold it for its TTL`;
      out["manifest_cache_control"] = response.headers.get("cache-control");
    }
  } catch (error) {
    out["manifest"] =
      `unreachable: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (sampleKey !== null) {
    try {
      const response = await fetch(`${cdnBaseUrl}/${sampleKey}`, {
        method: "HEAD",
        cache: "no-store",
        headers: {
          origin: process.env["SITE_URL"] ?? "https://coppercork.com",
        },
      });
      out["sample"] = {
        key: sampleKey,
        status: response.status,
        content_type: response.headers.get("content-type"),
        cache_control: response.headers.get("cache-control"),
        cors: response.headers.get("access-control-allow-origin"),
      };
    } catch (error) {
      out["sample"] =
        `unreachable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const options = parseArgs(process.argv.slice(2));
  const log = (fields: Record<string, unknown>): void =>
    console.error(
      JSON.stringify({ run_id: runId, job: "media:publish", ...fields }),
    );
  const manifestPath = join(options.mediaDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `no manifest at ${manifestPath}; build the media first (scripts/media/prepare.ts)`,
    );
  }
  const manifest = MediaManifest.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")),
  );
  const plan = planPublish(manifest, await scanMedia(options.mediaDir));
  const totalBytes = plan.objects.reduce((sum, o) => sum + o.bytes, 0);

  const settings = loadBlobSettings(repoRoot);
  if ("missing" in settings) {
    if (!options.dryRun) {
      throw new Error(`missing in .env.local: ${settings.missing}`);
    }
    console.log(
      JSON.stringify({
        run_id: runId,
        job: "media:publish",
        dry_run: true,
        credentials: `missing ${settings.missing}; plan only`,
        objects: plan.objects.length,
        bytes: totalBytes,
        unreferenced: plan.unreferenced.length,
        errors: 0,
        duration_ms: Date.now() - started,
      }),
    );
    return;
  }

  const result = await syncToStore(plan, vercelBlobStore(settings.auth), {
    dryRun: options.dryRun,
    prune: options.prune,
    allowCoverDrop: options.allowCoverDrop,
    concurrency: options.concurrency,
    readFile: (src) =>
      readFileSync(join(options.mediaDir, ...src.split("/").slice(2))),
    log,
  });

  const cdnBaseUrl = settings.cdnBaseUrl ?? result.storeBaseUrl;
  const cdn =
    options.dryRun || cdnBaseUrl === null
      ? "not checked"
      : await checkCdn(
          cdnBaseUrl,
          plan.manifest.generated_at,
          result.sampleKey,
        );

  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:publish",
      dry_run: options.dryRun,
      auth: "token" in settings.auth ? "read-write token" : "OIDC",
      store_base_url: result.storeBaseUrl,
      cdn_base_url: settings.cdnBaseUrl,
      objects: result.objects,
      bytes: result.bytes,
      already_there: result.alreadyThere,
      uploaded: result.uploaded,
      uploaded_bytes: result.uploadedBytes,
      manifest: result.manifest,
      manifest_generated_at: plan.manifest.generated_at,
      unreferenced_local: plan.unreferenced.length,
      orphans: result.orphans,
      pruned: result.pruned,
      ...(result.pruneNote === null ? {} : { prune: result.pruneNote }),
      ...(result.droppedCovers.length === 0
        ? {}
        : { dropped_covers: result.droppedCovers }),
      cdn,
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
      job: "media:publish",
      error: error instanceof Error ? error.message : String(error),
      errors: 1,
    }),
  );
  process.exitCode = 1;
}
