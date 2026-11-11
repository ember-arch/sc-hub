/**
 * Brings the store into line with a publish plan (ADR-034): uploads the objects it lacks, then the
 * manifest, and counts (or, on request, deletes) what the manifest no longer names. Takes the
 * store and the file reader as parameters, so the unit tests run it against an in-memory store.
 *
 * Since ADR-048 the hand publish is not the only writer of the manifest: the News workflow adds new
 * Comm-Link covers to it. So the sync reads the live manifest from the store before it uploads
 * anything, refuses a manifest that would drop a cover the live one has (a checkout without the
 * CI's covers: run fetch-covers.ts and prepare.ts first), and writes its manifest only if the live
 * one is still the one it read (a conditional write on its ETag).
 */
import { createHash } from "node:crypto";
import { type MediaStore, type StoredObject, storeBaseUrl } from "./blob.js";
import {
  IMMUTABLE_MAX_AGE,
  MANIFEST_KEY,
  MANIFEST_MAX_AGE,
  type PublishPlan,
} from "./publish-plan.js";

export interface SyncOptions {
  readonly dryRun: boolean;
  readonly prune: boolean;
  /** Let the new manifest lack covers the live one has (a takedown, ADR-048); refused otherwise. */
  readonly allowCoverDrop?: boolean;
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
  /** Covers the live manifest had and this one does not (only with `allowCoverDrop`). */
  readonly droppedCovers: readonly string[];
}

/** The Comm-Link ids whose cover the live manifest lists and `next` does not (ADR-048). */
export function droppedCovers(
  live: Uint8Array,
  next: { readonly covers: readonly { readonly external_id: string }[] },
): string[] {
  const parsed = JSON.parse(new TextDecoder().decode(live)) as {
    covers?: unknown;
  };
  const liveIds = Array.isArray(parsed.covers)
    ? parsed.covers
        .map((c) => (c as { external_id?: unknown }).external_id)
        .filter((id): id is string => typeof id === "string")
    : [];
  const kept = new Set(next.covers.map((c) => c.external_id));
  return liveIds.filter((id) => !kept.has(id));
}

/** The error a conditional write that lost its race carries (`classifyBlobError`). */
export const lostRace = (error: unknown): boolean =>
  (error as { status?: unknown }).status === 412;

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

/**
 * Retries a store call on anything but a refusal. The store adapter puts a 4xx `status` on an error
 * that will not pass until something changes (`classifyBlobError`), 429 with the store's own wait
 * on rate limiting; a network error or a 5xx has neither and is retried with backoff.
 */
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
      const retryAfter = (error as { retryAfter?: unknown }).retryAfter;
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
      const ms =
        typeof retryAfter === "number" && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** (n - 1);
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
  // The live manifest, from the store, before anything goes up: the cover guard reads it, and the
  // manifest's write at the end is conditional on it still being this one (ADR-048).
  const live = existing.has(MANIFEST_KEY)
    ? await withRetries("read manifest", () => store.read(MANIFEST_KEY), log)
    : null;
  const dropped = live === null ? [] : droppedCovers(live.bytes, plan.manifest);
  if (dropped.length > 0 && options.allowCoverDrop !== true) {
    throw new Error(
      `the live manifest has ${dropped.length} cover(s) this one lacks (${dropped.slice(0, 8).join(", ")}${dropped.length > 8 ? ", ..." : ""}), most likely added by the News workflow (ADR-048): run fetch-covers.ts and prepare.ts in this checkout, then publish again; pass --allow-cover-drop only when they are meant to go`,
    );
  }
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
    if (live !== null && sameBytes(live.bytes, body)) manifest = "unchanged";
    else {
      let stored: StoredObject;
      try {
        stored = await withRetries(
          MANIFEST_KEY,
          () =>
            store.put(MANIFEST_KEY, body, {
              contentType: "application/json",
              cacheMaxAge: MANIFEST_MAX_AGE,
              overwrite: true,
              ...(live === null ? {} : { ifMatch: live.etag }),
            }),
          log,
        );
      } catch (error) {
        if (!lostRace(error)) throw error;
        throw new Error(
          "the live manifest changed while this publish ran (the News workflow's cover step, ADR-048, or another publish); nothing was overwritten: run fetch-covers.ts and prepare.ts, then publish again",
          { cause: error },
        );
      }
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
      first === undefined ? null : storeBaseUrl(first.url, first.key),
    sampleKey: plan.objects[0]?.key ?? null,
    droppedCovers: dropped,
  };
}

export { IMMUTABLE_MAX_AGE };
