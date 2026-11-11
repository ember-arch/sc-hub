/**
 * Brings the store into line with a publish plan (ADR-034): uploads the objects it lacks, then the
 * manifest, and counts (or, on request, deletes) what the manifest no longer names. Takes the
 * store and the file reader as parameters, so the unit tests run it against an in-memory store.
 */
import { createHash } from "node:crypto";
import type { MediaStore, StoredObject } from "./blob.js";
import {
  IMMUTABLE_MAX_AGE,
  MANIFEST_KEY,
  MANIFEST_MAX_AGE,
  type PublishPlan,
} from "./publish-plan.js";

export interface SyncOptions {
  readonly dryRun: boolean;
  readonly prune: boolean;
  readonly concurrency: number;
  /** The bytes of a planned object, by its local `src`. */
  readonly readFile: (src: string) => Uint8Array;
  readonly log?: (fields: Record<string, unknown>) => void;
  /** How often to report progress, in uploads. */
  readonly progressEvery?: number;
}

export interface SyncResult {
  readonly objects: number;
  readonly bytes: number;
  readonly alreadyThere: number;
  readonly uploaded: number;
  readonly uploadedBytes: number;
  readonly manifest: "uploaded" | "unchanged" | "dry run";
  readonly orphans: number;
  readonly pruned: number;
  readonly pruneNote: string | null;
  /** The store's public base, from the first object seen, or null when the store is empty. */
  readonly storeBaseUrl: string | null;
  readonly sampleKey: string | null;
}

/** Runs `work` over `items`, at most `limit` at a time, in order of submission. */
export async function inParallel<T>(
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

/** Retries a store call on anything but a plain refusal; a 4xx-style error names itself `status`. */
export async function withRetries<T>(
  label: string,
  attempt: () => Promise<T>,
  log: (fields: Record<string, unknown>) => void = () => {},
  attempts = 4,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let n = 1; ; n += 1) {
    try {
      return await attempt();
    } catch (error) {
      const status = (error as { status?: unknown }).status;
      // A refusal (bad token, no such store) is a decision, not weather: stop at once. A timeout
      // (408) or rate limiting (429) means "later".
      if (
        typeof status === "number" &&
        status >= 400 &&
        status < 500 &&
        status !== 408 &&
        status !== 429
      )
        throw error;
      if (n >= attempts) throw error;
      const ms = 1000 * 2 ** (n - 1);
      log({ retry: label, attempt: n, wait_ms: ms });
      await wait(ms);
    }
  }
}

export const manifestBody = (plan: PublishPlan): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(plan.manifest, null, 2)}\n`);

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.byteLength === b.byteLength && sha256(a) === sha256(b);

export async function syncToStore(
  plan: PublishPlan,
  store: MediaStore,
  options: SyncOptions,
): Promise<SyncResult> {
  const log = options.log ?? (() => {});
  const existing = await withRetries("list", () => store.list("media/"), log);
  const planned = new Set(plan.objects.map((o) => o.key));
  const toUpload = plan.objects.filter((o) => {
    const held = existing.get(o.key);
    // A key is its content, so one that is there is done; a size that differs means a half-written
    // object from an interrupted run, which the new copy replaces.
    return held === undefined || held.size !== o.bytes;
  });

  let uploaded = 0;
  let uploadedBytes = 0;
  let first: StoredObject | undefined = [...existing.values()][0];
  if (!options.dryRun) {
    await inParallel(toUpload, options.concurrency, async (object) => {
      const body = options.readFile(object.src);
      // The key promises these exact bytes for a year: refuse to fill it with anything else, which
      // is what a prepare.ts run in the same folder between the scan and now would do.
      if (sha256(body) !== object.sha256) {
        throw new Error(
          `${object.src} changed on disk since it was scanned (is prepare.ts running?); publish again when it has finished`,
        );
      }
      const stored = await withRetries(
        object.key,
        () =>
          store.put(object.key, body, {
            contentType: object.contentType,
            cacheMaxAge: object.cacheMaxAge,
            overwrite: existing.has(object.key),
          }),
        log,
      );
      first ??= stored;
      uploaded += 1;
      uploadedBytes += object.bytes;
      if (uploaded % (options.progressEvery ?? 500) === 0) {
        log({
          progress: `${uploaded}/${toUpload.length}`,
          mb: Number((uploadedBytes / 1e6).toFixed(1)),
        });
      }
    });
  }

  const body = manifestBody(plan);
  let manifest: SyncResult["manifest"];
  if (options.dryRun) manifest = "dry run";
  else {
    const current = existing.has(MANIFEST_KEY)
      ? await withRetries("read manifest", () => store.read(MANIFEST_KEY), log)
      : null;
    if (current !== null && sameBytes(current, body)) manifest = "unchanged";
    else {
      const stored = await withRetries(
        MANIFEST_KEY,
        () =>
          store.put(MANIFEST_KEY, body, {
            contentType: "application/json",
            cacheMaxAge: MANIFEST_MAX_AGE,
            overwrite: true,
          }),
        log,
      );
      first ??= stored;
      manifest = "uploaded";
    }
  }

  const orphans = [...existing.keys()].filter(
    (key) => !planned.has(key) && key !== MANIFEST_KEY,
  );
  let pruned = 0;
  let pruneNote: string | null = null;
  if (options.prune && !options.dryRun && manifest === "uploaded") {
    // The live site names the old keys until its next build fetches the new manifest, and the CDN
    // may serve the old manifest for its TTL: deleting now would break pictures that are live.
    pruneNote =
      "skipped: the manifest changed this run; prune on a later run, after the site has redeployed";
  } else if (options.prune && !options.dryRun) {
    await inParallel(orphans, options.concurrency, async (key) => {
      await withRetries(`delete ${key}`, () => store.delete(key), log);
      pruned += 1;
    });
  }

  return {
    objects: plan.objects.length,
    bytes: plan.objects.reduce((sum, o) => sum + o.bytes, 0),
    alreadyThere: plan.objects.length - toUpload.length,
    uploaded,
    uploadedBytes,
    manifest,
    orphans: orphans.length,
    pruned,
    pruneNote,
    storeBaseUrl:
      first === undefined ? null : first.url.slice(0, -(first.key.length + 1)),
    sampleKey: plan.objects[0]?.key ?? null,
  };
}

export { IMMUTABLE_MAX_AGE };
