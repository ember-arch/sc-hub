/**
 * Copies the pictures CIG staff attached to the Spectrum posts on the news pack into
 * `fixtures/spectrum-media/` (git-ignored) and records where each came from in
 * `fixtures/spectrum-media/sources.json` (ADR-037).
 *
 * The addresses come from `fixtures/spectrum/uploads.json`, which the Spectrum worker writes when
 * it reads a thread's posts in full; only the uploads a shown post names (the latest revision of
 * each Spectrum item, none under takedown, by the `data-upload` on its `img`) are fetched, at the
 * size they were uploaded, one request every 5 seconds (CLAUDE.md section 9: the host is RSI's),
 * with the project User-Agent and the contact address, without cookies or a signed-in session. A
 * copy already on disk from the same address is kept.
 *
 *   pnpm exec tsx scripts/media/fetch-spectrum.ts [--limit <n>]
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { RSI_SPACING_MS, SpectrumSource, createSpacer } from "./sources.js";
import { rsiUserAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const newsFile = join(repoRoot, "fixtures", "news", "ContentItem.json");
const uploadsFile = join(repoRoot, "fixtures", "spectrum", "uploads.json");
const outDir = join(repoRoot, "fixtures", "spectrum-media");
const sourcesPath = join(outDir, "sources.json");

/** One row of `fixtures/spectrum/uploads.json`, as the worker writes it. */
export const UploadRow = z.strictObject({
  upload_id: z.string().regex(/^\d+$/),
  url: z.url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  /** The post the upload is attached to: Spectrum's id and the post's page. */
  post_id: z.string().min(1),
  post_url: z.url(),
  thread_id: z.string().min(1),
  seen_at: z.iso.datetime({ offset: true }),
});
export type UploadRow = z.infer<typeof UploadRow>;

const PackRow = z
  .object({
    source: z.string(),
    external_id: z.string(),
    body_html: z.string(),
    revision: z.number().int(),
    takedown: z.boolean(),
  })
  .loose();

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** The upload ids a post's HTML names: every `data-upload` on an `img`. */
export function uploadIdsIn(bodyHtml: string): string[] {
  const out = new Set<string>();
  for (const match of bodyHtml.matchAll(/<img\b[^>]*\bdata-upload="(\d+)"/g)) {
    out.add(match[1]!);
  }
  return [...out];
}

/**
 * Which uploads to copy: those named by a shown Spectrum post (its latest revision, not under
 * takedown), each with the address the worker recorded for it. An upload a post names but the
 * worker never recorded is reported, not guessed.
 */
export function wantedUploads(
  pack: readonly z.infer<typeof PackRow>[],
  uploads: readonly UploadRow[],
): { readonly wanted: UploadRow[]; readonly unrecorded: string[] } {
  const latest = new Map<string, z.infer<typeof PackRow>>();
  for (const row of pack) {
    if (row.source !== "spectrum") continue;
    const seen = latest.get(row.external_id);
    if (seen === undefined || row.revision > seen.revision)
      latest.set(row.external_id, row);
  }
  const named = new Set<string>();
  for (const row of latest.values()) {
    if (row.takedown) continue;
    for (const id of uploadIdsIn(row.body_html)) named.add(id);
  }
  const byId = new Map(uploads.map((u) => [u.upload_id, u] as const));
  const wanted: UploadRow[] = [];
  const unrecorded: string[] = [];
  for (const id of [...named].sort((a, b) => Number(a) - Number(b))) {
    const row = byId.get(id);
    if (row === undefined) unrecorded.push(id);
    else wanted.push(row);
  }
  return { wanted, unrecorded };
}

function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const limit = Number(flag(process.argv.slice(2), "--limit") ?? Infinity);
  const pack = existsSync(newsFile)
    ? z.array(PackRow).parse(JSON.parse(readFileSync(newsFile, "utf8")))
    : [];
  const uploads = existsSync(uploadsFile)
    ? z.array(UploadRow).parse(JSON.parse(readFileSync(uploadsFile, "utf8")))
    : [];
  const { wanted, unrecorded } = wantedUploads(pack, uploads);
  mkdirSync(outDir, { recursive: true });
  const previous: SpectrumSource[] = existsSync(sourcesPath)
    ? z
        .array(SpectrumSource)
        .parse(JSON.parse(readFileSync(sourcesPath, "utf8")))
    : [];
  const spacer = createSpacer(
    RSI_SPACING_MS,
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    Date.now,
  );
  const userAgent = rsiUserAgent("media");

  const rows = new Map(previous.map((r) => [r.upload_id, r] as const));
  let fetched = 0;
  let reused = 0;
  let failed = 0;
  for (const upload of wanted) {
    const kept = rows.get(upload.upload_id);
    if (
      kept !== undefined &&
      kept.image_url === upload.url &&
      existsSync(join(outDir, kept.file))
    ) {
      reused += 1;
      continue;
    }
    if (fetched >= limit) break;
    await spacer();
    const response = await fetch(upload.url, {
      headers: { "User-Agent": userAgent },
    });
    if (!response.ok) {
      // One picture gone from Spectrum does not stop the rest; it is reported and stays a
      // placeholder on the site.
      process.stderr.write(
        `${JSON.stringify({ run_id: runId, event: "spectrum-media.status", upload_id: upload.upload_id, status: response.status })}\n`,
      );
      failed += 1;
      continue;
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim();
    const extension = EXTENSIONS[contentType];
    if (extension === undefined) {
      throw new Error(`${upload.url}: unexpected type ${contentType}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = `${upload.upload_id}.${extension}`;
    writeFileSync(join(outDir, file), bytes);
    rows.set(
      upload.upload_id,
      SpectrumSource.parse({
        upload_id: upload.upload_id,
        file,
        page_url: upload.post_url,
        image_url: upload.url,
        content_type: contentType,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        fetched_at: new Date().toISOString(),
      }),
    );
    fetched += 1;
  }
  // The record holds a row for every upload a shown post still names; a row for a picture whose
  // post left the pack or went under takedown is dropped, and the file with it on the next clean.
  const stillWanted = new Set(wanted.map((u) => u.upload_id));
  const record = [...rows.values()]
    .filter((r) => stillWanted.has(r.upload_id))
    .sort((a, b) => Number(a.upload_id) - Number(b.upload_id));
  writeFileSync(sourcesPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-spectrum",
      wanted: wanted.length,
      unrecorded: unrecorded.length,
      fetched,
      reused,
      failed,
      on_disk: record.length,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  await main();
}
