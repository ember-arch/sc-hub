/**
 * Publishes the covers of new Comm-Links straight to the media store, from CI (ADR-051).
 *
 * CI has none of the git-ignored media, so it cannot run `prepare.ts`, which rebuilds the whole
 * manifest from the complete `fixtures/`. This path touches covers only: it reads the live manifest
 * from the store, finds the Comm-Links on record from the last `recentDays` that it lacks a cover
 * for, reads RSI's hub for just those (at the polite rate, CLAUDE.md section 9), builds their
 * renditions with the encoder `prepare.ts` uses, uploads them under the same content-addressed
 * keys (ADR-034), and adds them to the manifest it read. Every other entry is carried over byte for
 * byte and checked, and the manifest goes back only if the store still holds the one it read (a
 * conditional write on its ETag); on a lost race it reads again and merges again.
 *
 * Everything outside is injected (the fetch, the store, the encoder, the clock), so the unit tests
 * run it with no network (CLAUDE.md section 6).
 */
import { createHash } from "node:crypto";
import { CoverImage, MediaManifest } from "schema";
import { z } from "zod";
import type { MediaStore } from "./blob.js";
import type { EncodedRendition } from "./cover-renditions.js";
import {
  IMMUTABLE_MAX_AGE,
  MANIFEST_KEY,
  MANIFEST_MAX_AGE,
  hashedPath,
} from "./publish-plan.js";
import { lostRace, withRetries } from "./publish-sync.js";
import {
  COMM_LINK_HUB_URL,
  CoverSource,
  RSI_ORIGIN,
  RSI_SPACING_MS,
  coverRenditionPath,
  coversFromHub,
  createSpacer,
} from "./sources.js";

/** A Comm-Link older than this without a cover is not on the hub (Q&As, patch notes) and is left alone. */
export const RECENT_DAYS = 14;
/** The hub lists the newest first; a recent Comm-Link is on its first page or two. */
export const HUB_PAGES = 3;
/** Conditional writes before the run gives up: each loss means another writer just wrote. */
export const MANIFEST_ATTEMPTS = 3;
/** How long after its write the run waits at least before the commit that redeploys the site. */
export const CDN_SETTLE_MS = 60_000;

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PackRow = z
  .object({
    source: z.string(),
    external_id: z.string(),
    url: z.string(),
    published_at: z.string(),
    revision: z.number().int(),
    takedown: z.boolean(),
  })
  .loose();

export interface OnRecord {
  readonly url: string;
  readonly publishedAt: string;
}

/** The Comm-Links the site can show: the latest revision of each, none under takedown. */
export function commLinksOnRecord(rows: unknown): Map<string, OnRecord> {
  const latest = new Map<string, z.infer<typeof PackRow>>();
  for (const row of z.array(PackRow).parse(rows)) {
    if (row.source !== "comm_link") continue;
    const seen = latest.get(row.external_id);
    if (seen === undefined || row.revision > seen.revision)
      latest.set(row.external_id, row);
  }
  return new Map(
    [...latest.values()]
      .filter((row) => !row.takedown)
      .map((row) => [
        row.external_id,
        { url: row.url, publishedAt: row.published_at },
      ]),
  );
}

/**
 * The Comm-Links to look for: on record, published in the last `recentDays`, without a cover in
 * the live manifest. Newest first.
 */
export function coverCandidates(
  onRecord: ReadonlyMap<string, OnRecord>,
  covered: ReadonlySet<string>,
  now: number,
  recentDays: number,
): string[] {
  const since = now - recentDays * 24 * 60 * 60 * 1000;
  return [...onRecord.entries()]
    .filter(([id, row]) => {
      const at = Date.parse(row.publishedAt);
      return !covered.has(id) && Number.isFinite(at) && at >= since;
    })
    .sort(
      ([a, x], [b, y]) =>
        y.publishedAt.localeCompare(x.publishedAt) || Number(b) - Number(a),
    )
    .map(([id]) => id);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const coverId = (entry: unknown): string =>
  isRecord(entry) && typeof entry["external_id"] === "string"
    ? entry["external_id"]
    : "";

/**
 * Checks that `after` is `before` with covers added and nothing else changed but `generated_at`:
 * the same fields, every other field identical, every cover `before` had still there unchanged.
 * Throws otherwise, so a merge that would drop or alter anything never reaches the store.
 */
export function assertOnlyCoversAdded(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): void {
  const keys = (o: Record<string, unknown>): string =>
    Object.keys(o).sort().join(",");
  if (keys(before) !== keys(after)) {
    throw new Error(
      `cover merge changed the manifest's fields: ${keys(before)} -> ${keys(after)}`,
    );
  }
  for (const key of Object.keys(before)) {
    if (key === "covers" || key === "generated_at") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error(`cover merge changed the manifest's ${key}`);
    }
  }
  const was = Array.isArray(before["covers"]) ? before["covers"] : [];
  const now = new Map(
    (Array.isArray(after["covers"]) ? after["covers"] : []).map(
      (c) => [coverId(c), JSON.stringify(c)] as const,
    ),
  );
  for (const cover of was) {
    if (now.get(coverId(cover)) !== JSON.stringify(cover)) {
      throw new Error(`cover merge dropped or changed cover ${coverId(cover)}`);
    }
  }
}

/**
 * `liveText` with `additions` added to its covers (newest id first, as `prepare.ts` orders them)
 * and `generated_at` set; every other byte of every other entry is carried over as it was read,
 * not re-serialized through the schema, so its defaults and order stay the store's. Validated
 * against the schema before and after. Throws when an addition is already there.
 */
export function mergeCovers(
  liveText: string,
  additions: readonly CoverImage[],
  generatedAt: string,
): { text: string; manifest: MediaManifest } {
  const before: unknown = JSON.parse(liveText);
  MediaManifest.parse(before);
  if (!isRecord(before)) throw new Error("the live manifest is not an object");
  const live = Array.isArray(before["covers"]) ? before["covers"] : [];
  const held = new Set(live.map(coverId));
  for (const cover of additions) {
    if (held.has(cover.external_id)) {
      throw new Error(`cover ${cover.external_id} is already in the manifest`);
    }
  }
  const covers = [...additions.map((c) => CoverImage.parse(c)), ...live].sort(
    (a, b) => Number(coverId(b)) - Number(coverId(a)),
  );
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(before)) {
    after[key] =
      key === "covers" ? covers : key === "generated_at" ? generatedAt : value;
  }
  if (!("covers" in after)) after["covers"] = covers;
  const manifest = MediaManifest.parse(after);
  assertOnlyCoversAdded(
    before["covers"] === undefined ? { ...before, covers: [] } : before,
    after,
  );
  return { text: `${JSON.stringify(after, null, 2)}\n`, manifest };
}

/** How many entries each list in a manifest has: the summary's before and after. */
export function manifestCounts(
  manifest: MediaManifest,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(manifest)) {
    if (Array.isArray(value)) out[key] = value.length;
  }
  return out;
}

/** The committed record with `rows` added or replaced, newest id first; no row is dropped. */
export function mergeCoverSources(
  previous: readonly CoverSource[],
  rows: readonly CoverSource[],
): CoverSource[] {
  const merged = new Map(previous.map((r) => [r.external_id, r] as const));
  for (const row of rows) merged.set(row.external_id, row);
  return [...merged.values()].sort(
    (a, b) => Number(b.external_id) - Number(a.external_id),
  );
}

export interface CoverPublishDeps {
  /** RSI's hub and media host, and the CDN's read-back. */
  readonly fetch: typeof fetch;
  /** The media store; null for a dry run without credentials, which reads the CDN instead. */
  readonly store: MediaStore | null;
  /** The store's public address; the manifest is read back through it. */
  readonly cdnBaseUrl: string | null;
  readonly encode: (input: Buffer) => Promise<EncodedRendition[]>;
  readonly userAgent: () => string;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /** `fixtures/news/ContentItem.json`, parsed. */
  readonly newsRows: unknown;
  /** `fixtures/rsi-media/cover-sources.json`, the committed record. */
  readonly coverSources: readonly CoverSource[];
  readonly log?: (fields: Record<string, unknown>) => void;
}

export interface CoverPublishOptions {
  readonly dryRun: boolean;
  readonly pages: number;
  readonly recentDays: number;
  /**
   * Comm-Links to treat as uncovered although the live manifest has them: a dry rehearsal of the
   * whole path on a cover that is already up, whose keys should come out the same (ADR-051).
   */
  readonly rehearse?: readonly string[];
  /** How long to wait for the CDN to serve the new manifest before reporting it stale. */
  readonly cdnWaitMs: number;
  readonly cdnPollMs: number;
  /** At least this long after the write before the run ends (default `CDN_SETTLE_MS`). */
  readonly cdnSettleMs?: number;
  readonly spacingMs?: number;
}

export interface PlannedCover {
  readonly external_id: string;
  readonly keys: readonly string[];
}

export interface CoverPublishResult {
  readonly onRecord: number;
  readonly candidates: readonly string[];
  readonly hubPages: number;
  /** Candidates the hub's pages read this run did not list. */
  readonly notOnHub: readonly string[];
  readonly planned: readonly PlannedCover[];
  readonly uploaded: number;
  readonly alreadyThere: number;
  readonly manifest: "nothing to do" | "dry run" | "uploaded" | "already there";
  readonly attempts: number;
  readonly generatedAt: string | null;
  readonly before: Record<string, number>;
  readonly after: Record<string, number> | null;
  /** The committed record to write, or null when nothing changed (always null on a dry run). */
  readonly coverSources: CoverSource[] | null;
  readonly cdn: string;
  /** For a rehearsal: whether each rehearsed cover's planned keys are the live ones. */
  readonly rehearsal: Record<string, boolean> | null;
}

interface LiveManifest {
  readonly text: string;
  /** Null when read through the CDN (a dry run without credentials): no conditional write. */
  readonly etag: string | null;
}

interface Upload {
  readonly key: string;
  readonly data: Buffer;
}

export async function publishCovers(
  deps: CoverPublishDeps,
  options: CoverPublishOptions,
): Promise<CoverPublishResult> {
  const log = deps.log ?? (() => {});
  const rehearse = new Set(options.rehearse ?? []);
  const readLive = async (): Promise<LiveManifest> => {
    if (deps.store !== null) {
      const store = deps.store;
      const current = await withRetries(
        "read manifest",
        () => store.read(MANIFEST_KEY),
        log,
      );
      if (current === null) {
        throw new Error(
          "the store has no manifest: the first publish is the owner's (ADR-034)",
        );
      }
      return {
        text: new TextDecoder().decode(current.bytes),
        etag: current.etag,
      };
    }
    if (deps.cdnBaseUrl === null) {
      throw new Error("a dry run without credentials needs CDN_BASE_URL");
    }
    const url = `${deps.cdnBaseUrl}/${MANIFEST_KEY}`;
    const response = await deps.fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return { text: await response.text(), etag: null };
  };

  const first = await readLive();
  const liveManifest = MediaManifest.parse(JSON.parse(first.text));
  // A rehearsal plans as if the rehearsed covers were not up; nothing is written.
  const liveText =
    rehearse.size === 0
      ? first.text
      : `${JSON.stringify(
          {
            ...(JSON.parse(first.text) as Record<string, unknown>),
            covers: liveManifest.covers.filter(
              (c) => !rehearse.has(c.external_id),
            ),
          },
          null,
          2,
        )}\n`;
  const before = MediaManifest.parse(JSON.parse(liveText));
  const onRecord = commLinksOnRecord(deps.newsRows);
  const covered = new Set(before.covers.map((c) => c.external_id));
  const candidates = coverCandidates(
    onRecord,
    covered,
    deps.now(),
    options.recentDays,
  );
  // A rehearsed Comm-Link is looked for whatever its age, so a rehearsal never goes quiet.
  for (const id of rehearse) {
    if (onRecord.has(id) && !covered.has(id) && !candidates.includes(id))
      candidates.push(id);
  }
  const dryRun = options.dryRun || rehearse.size > 0;
  const base = {
    onRecord: onRecord.size,
    candidates,
    before: manifestCounts(before),
  };
  if (candidates.length === 0) {
    return {
      ...base,
      hubPages: 0,
      notOnHub: [],
      planned: [],
      uploaded: 0,
      alreadyThere: 0,
      manifest: "nothing to do",
      attempts: 0,
      generatedAt: null,
      after: null,
      coverSources: null,
      cdn: "not checked",
      rehearsal: null,
    };
  }

  // RSI: the hub's pages and the covers, one request at a time, 5 s apart, with the User-Agent.
  const spacer = createSpacer(
    options.spacingMs ?? RSI_SPACING_MS,
    deps.sleep,
    deps.now,
  );
  // The polls of the same job have just asked RSI: the first request waits the spacing too.
  let primed = false;
  const fromRsi = async (url: string): Promise<Response> => {
    if (!primed) {
      primed = true;
      await deps.sleep(options.spacingMs ?? RSI_SPACING_MS);
    }
    await spacer();
    const response = await deps.fetch(url, {
      headers: { "User-Agent": deps.userAgent() },
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response;
  };
  const wanted = new Set(candidates);
  const found = new Map<string, string>();
  let hubPages = 0;
  for (
    let page = 1;
    page <= options.pages && found.size < wanted.size;
    page += 1
  ) {
    const url =
      page === 1 ? COMM_LINK_HUB_URL : `${COMM_LINK_HUB_URL}?page=${page}`;
    const listed = coversFromHub(await (await fromRsi(url)).text());
    hubPages += 1;
    if (listed.length === 0) {
      // The first page always lists transmissions: none means the page's shape changed, and the
      // run halts rather than guess (CLAUDE.md section 5).
      if (page === 1) {
        throw new Error(
          "comm-link hub: no transmission block with a cover on the first page",
        );
      }
      break;
    }
    for (const { id, cover } of listed) {
      if (wanted.has(id) && !found.has(id)) found.set(id, cover);
    }
  }

  const additions: CoverImage[] = [];
  const rows: CoverSource[] = [];
  const uploads: Upload[] = [];
  const planned: PlannedCover[] = [];
  for (const id of candidates) {
    const imageUrl = found.get(id);
    if (imageUrl === undefined) continue;
    const response = await fromRsi(imageUrl);
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim();
    const extension = EXTENSIONS[contentType];
    if (extension === undefined) {
      throw new Error(`${imageUrl}: unexpected type ${contentType}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const encoded = await deps.encode(bytes);
    if (encoded.length === 0) {
      log({ skipped: id, reason: "narrower than every cover width" });
      continue;
    }
    const renditions = encoded.map((r) => {
      const src = hashedPath(
        coverRenditionPath(id, r.width),
        createHash("sha256").update(r.data).digest("hex"),
      );
      uploads.push({ key: src.slice(1), data: r.data });
      return { src, width: r.width, height: r.height };
    });
    const fetchedAt = new Date(deps.now()).toISOString();
    const pageUrl = onRecord.get(id)?.url ?? `${RSI_ORIGIN}/comm-link`;
    additions.push(
      CoverImage.parse({
        external_id: id,
        source: "rsi_comm_link_hub",
        page_url: pageUrl,
        image_url: imageUrl,
        fetched_at: fetchedAt,
        renditions,
      }),
    );
    rows.push(
      CoverSource.parse({
        external_id: id,
        file: `${id}.${extension}`,
        page_url: pageUrl,
        image_url: imageUrl,
        content_type: contentType,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        fetched_at: fetchedAt,
      }),
    );
    planned.push({
      external_id: id,
      keys: renditions.map((r) => r.src.slice(1)),
    });
  }
  const notOnHub = candidates.filter((id) => !found.has(id));
  const rehearsal =
    rehearse.size === 0
      ? null
      : Object.fromEntries(
          [...rehearse].map((id) => {
            const live = liveManifest.covers.find((c) => c.external_id === id);
            const mine = planned.find((p) => p.external_id === id);
            const same =
              live !== undefined &&
              mine !== undefined &&
              JSON.stringify(live.renditions.map((r) => r.src.slice(1))) ===
                JSON.stringify(mine.keys);
            return [id, same];
          }),
        );
  const common = {
    ...base,
    hubPages,
    notOnHub,
    planned,
    rehearsal,
  };
  if (additions.length === 0) {
    return {
      ...common,
      uploaded: 0,
      alreadyThere: 0,
      manifest: "nothing to do",
      attempts: 0,
      generatedAt: null,
      after: null,
      coverSources: null,
      cdn: "not checked",
    };
  }

  if (dryRun || deps.store === null) {
    const generatedAt = new Date(deps.now()).toISOString();
    const preview = mergeCovers(liveText, additions, generatedAt);
    return {
      ...common,
      uploaded: 0,
      alreadyThere: 0,
      manifest: "dry run",
      attempts: 0,
      generatedAt,
      after: manifestCounts(preview.manifest),
      coverSources: null,
      cdn: "not checked",
    };
  }
  const store = deps.store;

  // The renditions first, under keys that are their content: a repeat finds them there.
  const held = await withRetries(
    "list covers",
    () => store.list("media/covers/"),
    log,
  );
  let uploaded = 0;
  let alreadyThere = 0;
  let storeUrl: string | null = null;
  for (const upload of uploads) {
    const there = held.get(upload.key);
    if (there !== undefined && there.size === upload.data.byteLength) {
      alreadyThere += 1;
      continue;
    }
    const stored = await withRetries(
      upload.key,
      () =>
        store.put(upload.key, upload.data, {
          contentType: "image/webp",
          cacheMaxAge: IMMUTABLE_MAX_AGE,
          overwrite: there !== undefined,
        }),
      log,
    );
    storeUrl ??= stored.url.slice(0, -(upload.key.length + 1));
    uploaded += 1;
  }

  // Then the manifest: read, merge, write only if it is still the one read; on a loss, again.
  let live: LiveManifest = first;
  let attempts = 0;
  let generatedAt: string | null = null;
  let after: MediaManifest;
  let outcome: "uploaded" | "already there" = "uploaded";
  for (;;) {
    attempts += 1;
    const current = MediaManifest.parse(JSON.parse(live.text));
    const have = new Set(current.covers.map((c) => c.external_id));
    const adding = additions.filter((c) => !have.has(c.external_id));
    if (adding.length === 0) {
      // Either an earlier attempt of this run landed but its answer was lost (the SDK retried
      // it and the store refused the repeat with a 412): the covers are this run's own, byte
      // for byte, and the run carries on as if it had heard back. Or another writer put the
      // same covers up meanwhile, and there is nothing to add.
      const ours =
        attempts > 1 &&
        additions.every(
          (a) =>
            JSON.stringify(
              current.covers.find((c) => c.external_id === a.external_id),
            ) === JSON.stringify(a),
        );
      outcome = ours ? "uploaded" : "already there";
      if (ours) generatedAt = current.generated_at;
      after = current;
      break;
    }
    const stamp = new Date(deps.now()).toISOString();
    const merged = mergeCovers(live.text, adding, stamp);
    try {
      await withRetries(
        MANIFEST_KEY,
        () =>
          store.put(MANIFEST_KEY, new TextEncoder().encode(merged.text), {
            contentType: "application/json",
            cacheMaxAge: MANIFEST_MAX_AGE,
            overwrite: true,
            ifMatch: live.etag!,
          }),
        log,
      );
      generatedAt = stamp;
      after = merged.manifest;
      break;
    } catch (error) {
      if (!lostRace(error) || attempts >= MANIFEST_ATTEMPTS) throw error;
      log({ manifest: "changed since read; reading again", attempt: attempts });
      live = await readLive();
    }
  }

  // The site's next build reads the manifest through the CDN. The edge keeps a copy until an
  // overwrite purges it, which reaches every edge within about a minute: wait until this one
  // serves the new manifest, and at least `cdnSettleMs` from the write, before the commit that
  // redeploys the site.
  let cdn = "not checked";
  const cdnBase = deps.cdnBaseUrl ?? storeUrl;
  if (generatedAt !== null && cdnBase !== null) {
    const started = deps.now();
    const settle = options.cdnSettleMs ?? CDN_SETTLE_MS;
    cdn = `previous after ${Math.round(options.cdnWaitMs / 1000)} s`;
    for (;;) {
      try {
        const response = await deps.fetch(`${cdnBase}/${MANIFEST_KEY}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const seen = MediaManifest.parse(await response.json());
          if (seen.generated_at === generatedAt) {
            cdn = `current after ${Math.round((deps.now() - started) / 1000)} s`;
            const rest = started + settle - deps.now();
            if (rest > 0) await deps.sleep(rest);
            break;
          }
        }
      } catch (error) {
        log({ cdn: error instanceof Error ? error.message : String(error) });
      }
      if (deps.now() - started >= options.cdnWaitMs) break;
      await deps.sleep(options.cdnPollMs);
    }
  }

  return {
    ...common,
    uploaded,
    alreadyThere,
    manifest: outcome,
    attempts,
    generatedAt,
    after: manifestCounts(after),
    // The record, which is also what lands on main and so redeploys the site (ADR-051).
    coverSources:
      outcome === "uploaded"
        ? mergeCoverSources(deps.coverSources, rows)
        : null,
    cdn,
  };
}
