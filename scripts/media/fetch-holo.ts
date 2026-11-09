/**
 * Copies RSI's holoviewer models (ADR-015) into `fixtures/holo/` (git-ignored) and records where
 * each came from in `fixtures/holo/sources.json`. One request per file, at least 5 seconds apart,
 * with the project User-Agent; a file already copied from the same URL is skipped. Each file is
 * read once as OpenCTM so a model the decoder cannot read halts the run here, not on the page.
 *
 *   pnpm exec tsx scripts/media/fetch-holo.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readCtm } from "./ctm.js";
import { HOLO_FIGURE, HOLO_MODELS } from "./holo.js";
import { RSI_SPACING_MS, createSpacer } from "./sources.js";
import { rsiUserAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "fixtures", "holo");

interface Row {
  slug: string;
  file: string;
  url: string;
  page: string | null;
  bytes: number;
  sha256: string;
  vertices: number;
  triangles: number;
  fetched_at: string;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  mkdirSync(outDir, { recursive: true });
  const sourcesPath = join(outDir, "sources.json");
  const previous: Row[] = existsSync(sourcesPath)
    ? (JSON.parse(readFileSync(sourcesPath, "utf8")) as Row[])
    : [];
  const spacer = createSpacer(
    RSI_SPACING_MS,
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    Date.now,
  );
  const wanted = [
    ...HOLO_MODELS.map((m) => ({ slug: m.slug, url: m.url, page: m.page })),
    { slug: HOLO_FIGURE.slug, url: HOLO_FIGURE.url, page: null },
  ];
  const rows: Row[] = [];
  let fetched = 0;
  for (const item of wanted) {
    const file = `${item.slug}.ctm`;
    const known = previous.find((r) => r.file === file && r.url === item.url);
    if (known !== undefined && existsSync(join(outDir, file))) {
      rows.push(known);
      continue;
    }
    await spacer();
    const response = await fetch(item.url, {
      headers: { "User-Agent": rsiUserAgent("media") },
    });
    if (!response.ok)
      throw new Error(`${item.url} returned ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mesh = readCtm(bytes);
    writeFileSync(join(outDir, file), bytes);
    fetched += 1;
    rows.push({
      slug: item.slug,
      file,
      url: item.url,
      page: item.page,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      vertices: mesh.vertices.length / 3,
      triangles: mesh.indices.length / 3,
      fetched_at: new Date().toISOString(),
    });
  }
  writeFileSync(sourcesPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-holo",
      in: wanted.length,
      out: rows.length,
      fetched,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
