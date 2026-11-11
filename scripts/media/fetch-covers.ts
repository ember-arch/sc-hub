/**
 * Copies RSI's cover for each Comm-Link on record into `fixtures/rsi-media/covers/` (git-ignored)
 * and records where each came from in `fixtures/rsi-media/cover-sources.json` (ADR-029).
 *
 * The Comm-Link hub lists each transmission with its cover and pages by `?page=N`, ten a page.
 * One request per hub page and one per cover not yet on disk, at least 5 seconds apart
 * (CLAUDE.md section 9), with the project User-Agent and the contact address, without cookies or
 * a signed-in session. Only the Comm-Links in the news pack are fetched; a cover already copied
 * from the same address is kept. The hub is read until every Comm-Link on record has a cover,
 * six pages in a row add nothing, a page lists nothing, or `--pages <n>` (default 80) is reached.
 *
 *   pnpm exec tsx scripts/media/fetch-covers.ts [--pages <n>]
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  COMM_LINK_HUB_URL,
  CoverSource,
  RSI_ORIGIN,
  RSI_SPACING_MS,
  coversFromHub,
  createSpacer,
} from "./sources.js";
import { rsiUserAgent } from "../user-agent.js";
import { type OnRecord, commLinksOnRecord } from "./cover-publish.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const newsFile = join(repoRoot, "fixtures", "news", "ContentItem.json");
const outDir = join(repoRoot, "fixtures", "rsi-media", "covers");
const sourcesPath = join(
  repoRoot,
  "fixtures",
  "rsi-media",
  "cover-sources.json",
);

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

/** The Comm-Links the site can show: the latest revision of each, none under takedown. */
function onRecord(): Map<string, OnRecord> {
  if (!existsSync(newsFile)) return new Map();
  return commLinksOnRecord(JSON.parse(readFileSync(newsFile, "utf8")));
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const pages = Number(flag(process.argv.slice(2), "--pages") ?? 80);
  const wanted = onRecord();
  mkdirSync(outDir, { recursive: true });
  const previous: CoverSource[] = existsSync(sourcesPath)
    ? z.array(CoverSource).parse(JSON.parse(readFileSync(sourcesPath, "utf8")))
    : [];
  const spacer = createSpacer(
    RSI_SPACING_MS,
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    Date.now,
  );
  const get = async (url: string): Promise<Response> => {
    await spacer();
    const response = await fetch(url, {
      headers: { "User-Agent": rsiUserAgent("media") },
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response;
  };

  // The hub, page by page: each transmission's cover by RSI's id.
  const covers = new Map<string, string>();
  const missing = (): number =>
    [...wanted.keys()].filter((id) => !covers.has(id)).length;
  let read = 0;
  let quiet = 0;
  for (let page = 1; page <= pages && missing() > 0; page += 1) {
    const url =
      page === 1 ? COMM_LINK_HUB_URL : `${COMM_LINK_HUB_URL}?page=${page}`;
    const found = coversFromHub(await (await get(url)).text());
    read += 1;
    if (found.length === 0) {
      // The first page always lists transmissions; none means the page's shape changed or the
      // hub is down, and the run halts rather than record nothing (CLAUDE.md section 5).
      if (page === 1) {
        throw new Error(
          "comm-link hub: no transmission block with a cover on the first page",
        );
      }
      break;
    }
    let added = 0;
    for (const { id, cover } of found) {
      if (!wanted.has(id) || covers.has(id)) continue;
      covers.set(id, cover);
      added += 1;
    }
    quiet = added === 0 ? quiet + 1 : 0;
    // The hub's pages are not in date order: a quiet page is not the end, so six in a row are.
    if (quiet >= 6) break;
  }

  // Each cover once, at the polite rate; a copy from the same address is kept.
  const rows: CoverSource[] = [];
  let reused = 0;
  for (const [id, imageUrl] of [...covers.entries()].sort(
    (a, b) => Number(b[0]) - Number(a[0]),
  )) {
    const kept = previous.find(
      (r) => r.external_id === id && r.image_url === imageUrl,
    );
    if (kept !== undefined && existsSync(join(outDir, kept.file))) {
      rows.push(kept);
      reused += 1;
      continue;
    }
    const response = await get(imageUrl);
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim();
    const extension = EXTENSIONS[contentType];
    if (extension === undefined) {
      throw new Error(`${imageUrl}: unexpected type ${contentType}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = `${id}.${extension}`;
    writeFileSync(join(outDir, file), bytes);
    const pageUrl = wanted.get(id)?.url ?? `${RSI_ORIGIN}/comm-link`;
    rows.push(
      CoverSource.parse({
        external_id: id,
        file,
        page_url: pageUrl,
        image_url: imageUrl,
        content_type: contentType,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        fetched_at: new Date().toISOString(),
      }),
    );
  }
  // The record never shrinks: a cover the hub did not list this time (its pages are not in date
  // order, and a run may stop early) keeps its row, and a row stands until its Comm-Link leaves
  // the pack. A new copy replaces the row for the same Comm-Link.
  const merged = new Map(
    previous
      .filter((r) => wanted.has(r.external_id))
      .map((r) => [r.external_id, r] as const),
  );
  for (const row of rows) merged.set(row.external_id, row);
  const record = [...merged.values()].sort(
    (a, b) => Number(b.external_id) - Number(a.external_id),
  );
  writeFileSync(sourcesPath, `${JSON.stringify(record, null, 2)}\n`);
  const withoutCover = [...wanted.keys()]
    .filter((id) => !merged.has(id))
    .sort((a, b) => Number(b) - Number(a));
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-covers",
      on_record: wanted.size,
      hub_pages: read,
      seen_this_run: rows.length,
      reused,
      covered: record.length,
      without_cover: withoutCover.length,
      without_cover_ids: withoutCover,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

await main();
