/**
 * Publishes the built media to the Cloudflare R2 bucket behind the CDN (ADR-034): everything
 * `prepare.ts` wrote to `apps/web/public/media/`, manifest included. Run by hand on the owner's
 * machine, where the complete media lives; never from CI, which has no media and no credentials.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/media/publish.ts [options]
 *
 *   --media <dir>     the built media folder (default apps/web/public/media)
 *   --dry-run         plan and list only; upload nothing (plans without credentials too)
 *   --prune           delete objects the new manifest no longer names (default: count them)
 *   --no-cors         skip setting the bucket's CORS rule
 *   --concurrency <n> parallel uploads (default 8)
 *
 * Credentials come from `.env.local` (then `.env`) at the repository root, never from arguments:
 * R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, CDN_BASE_URL. Nothing here
 * prints a value from them.
 *
 * Every file goes up under a content-addressed key (`publish-plan.ts`) with a one-year immutable
 * Cache-Control, so a run uploads only what the bucket lacks and never overwrites a key; the
 * manifest, rewritten to those keys, goes up last with a five-minute TTL. The run ends by reading
 * the manifest back through the CDN and asking it for one picture with CORS, and says what it saw.
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
import { envSchema } from "schema/env";
import {
  type LocalFile,
  MANIFEST_CACHE,
  MANIFEST_KEY,
  planPublish,
} from "./publish-plan.js";
import { CORS_RULES, R2Client, R2Error } from "./r2.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

interface Options {
  mediaDir: string;
  dryRun: boolean;
  prune: boolean;
  cors: boolean;
  concurrency: number;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    mediaDir: join(repoRoot, "apps", "web", "public", "media"),
    dryRun: false,
    prune: false,
    cors: true,
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
    else if (arg === "--no-cors") options.cors = false;
    else if (arg === "--concurrency") options.concurrency = Number(next());
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency needs a positive whole number");
  }
  return options;
}

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "CDN_BASE_URL",
] as const;

interface Settings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  cdnBaseUrl: string;
}

/** `.env.local` then `.env` at the repository root; a variable already set wins over both. */
function loadSettings(): Settings | { missing: string[] } {
  for (const file of [".env.local", ".env"]) {
    const path = join(repoRoot, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
  const source: Record<string, string> = {};
  for (const key of R2_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== "") source[key] = value;
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const env = parsed.data;
  const missing = R2_KEYS.filter((key) => env[key] === undefined);
  if (missing.length > 0) return { missing: [...missing] };
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    cdnBaseUrl: env.CDN_BASE_URL!.replace(/\/+$/, ""),
  };
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
      const src = `/media/${relative(mediaDir, path).split("\\").join("/")}`;
      out.push({
        src,
        sha256: await sha256File(path),
        bytes: statSync(path).size,
      });
    }
  };
  await walk(mediaDir);
  return out;
}

async function withRetries<T>(
  label: string,
  attempt: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  for (let n = 1; ; n += 1) {
    try {
      return await attempt();
    } catch (error) {
      // A 4xx is a decision (bad credentials, no such bucket), not weather: stop at once.
      if (error instanceof R2Error && error.status < 500) throw error;
      if (n >= attempts) throw error;
      const wait = 1000 * 2 ** (n - 1);
      console.error(
        JSON.stringify({
          job: "media:publish",
          retry: label,
          attempt: n,
          wait_ms: wait,
        }),
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** Runs `work` over `items`, at most `limit` at a time, in order of submission. */
async function inParallel<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next]!;
        next += 1;
        await work(item);
      }
    },
  );
  await Promise.all(lanes);
}

/** Reads the manifest back through the CDN and asks for one object with CORS, as a browser would. */
async function checkCdn(
  cdnBaseUrl: string,
  generatedAt: string,
  sampleKey: string | undefined,
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
          : `previous (${remote.generated_at}); the CDN may hold it up to ${MANIFEST_CACHE}`;
      out["manifest_cache_control"] = response.headers.get("cache-control");
    }
  } catch (error) {
    out["manifest"] =
      `unreachable: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (sampleKey !== undefined) {
    try {
      const response = await fetch(`${cdnBaseUrl}/${sampleKey}`, {
        method: "HEAD",
        cache: "no-store",
        headers: { origin: "https://coppercork.com" },
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
  const manifestPath = join(options.mediaDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `no manifest at ${manifestPath}; build the media first (scripts/media/prepare.ts)`,
    );
  }
  const manifest = MediaManifest.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")),
  );
  const files = await scanMedia(options.mediaDir);
  const plan = planPublish(manifest, files);
  const planned = new Set(plan.objects.map((o) => o.key));
  const totalBytes = plan.objects.reduce((sum, o) => sum + o.bytes, 0);

  const settings = loadSettings();
  if ("missing" in settings) {
    if (!options.dryRun) {
      throw new Error(
        `missing in .env.local: ${settings.missing.join(", ")} (CLAUDE.md section 9)`,
      );
    }
    console.log(
      JSON.stringify({
        run_id: runId,
        job: "media:publish",
        dry_run: true,
        credentials: `missing ${settings.missing.join(", ")}; plan only`,
        objects: plan.objects.length,
        bytes: totalBytes,
        unreferenced: plan.unreferenced.length,
        errors: 0,
        duration_ms: Date.now() - started,
      }),
    );
    return;
  }

  const client = new R2Client({
    accountId: settings.accountId,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    bucket: settings.bucket,
  });

  let cors: string = options.cors ? "set" : "skipped";
  if (options.cors && !options.dryRun) {
    try {
      await withRetries("PutBucketCors", () => client.putCors());
    } catch (error) {
      if (error instanceof R2Error && error.status === 403) {
        cors =
          "not permitted for this token; paste this rule under the bucket's Settings → CORS policy";
        console.error(JSON.stringify(CORS_RULES, null, 2));
      } else throw error;
    }
  }

  const existing = await withRetries("ListObjectsV2", () =>
    client.list("media/"),
  );
  const toUpload = plan.objects.filter((o) => {
    const held = existing.get(o.key);
    // A key is its content, so one that is there is done; a size that differs means a half-written
    // object from an interrupted run, which the new copy replaces.
    return held === undefined || held.size !== o.bytes;
  });
  let uploaded = 0;
  let uploadedBytes = 0;
  if (!options.dryRun) {
    await inParallel(toUpload, options.concurrency, async (object) => {
      const body = readFileSync(
        join(options.mediaDir, ...object.src.split("/").slice(2)),
      );
      await withRetries(object.key, () =>
        client.put(object.key, body, {
          contentType: object.contentType,
          cacheControl: object.cacheControl,
        }),
      );
      uploaded += 1;
      uploadedBytes += object.bytes;
      if (uploaded % 500 === 0) {
        console.error(
          JSON.stringify({
            job: "media:publish",
            progress: `${uploaded}/${toUpload.length}`,
            mb: Number((uploadedBytes / 1e6).toFixed(1)),
          }),
        );
      }
    });
  }

  const manifestBody = `${JSON.stringify(plan.manifest, null, 2)}\n`;
  const manifestMd5 = createHash("md5").update(manifestBody).digest("hex");
  let manifestState: string;
  if (options.dryRun) manifestState = "dry run";
  else if (existing.get(MANIFEST_KEY)?.etag === manifestMd5)
    manifestState = "unchanged";
  else {
    await withRetries(MANIFEST_KEY, () =>
      client.put(MANIFEST_KEY, manifestBody, {
        contentType: "application/json",
        cacheControl: MANIFEST_CACHE,
      }),
    );
    manifestState = "uploaded";
  }

  const orphans = [...existing.keys()].filter(
    (key) => !planned.has(key) && key !== MANIFEST_KEY,
  );
  let pruned = 0;
  if (options.prune && !options.dryRun) {
    await inParallel(orphans, options.concurrency, async (key) => {
      await withRetries(`delete ${key}`, () => client.delete(key));
      pruned += 1;
    });
  }

  const cdn = options.dryRun
    ? "dry run"
    : await checkCdn(
        settings.cdnBaseUrl,
        plan.manifest.generated_at,
        plan.objects[0]?.key,
      );

  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:publish",
      dry_run: options.dryRun,
      bucket: settings.bucket,
      cdn_base_url: settings.cdnBaseUrl,
      cors,
      objects: plan.objects.length,
      bytes: totalBytes,
      already_there: plan.objects.length - toUpload.length,
      uploaded,
      uploaded_bytes: uploadedBytes,
      manifest: manifestState,
      manifest_generated_at: plan.manifest.generated_at,
      unreferenced_local: plan.unreferenced.length,
      orphans: orphans.length,
      pruned,
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
