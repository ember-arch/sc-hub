/**
 * Copies RSI's official image for each ship in the bootstrap pack into `fixtures/rsi-media/`
 * (git-ignored) and records where each came from in `fixtures/rsi-media/sources.json` (ADR-009).
 *
 * One request for the public ship matrix, then one per ship not yet on disk, at least 5 seconds
 * apart (CLAUDE.md section 9), without cookies or a signed-in session. It fetches the pack's ships
 * and the concept ships (ADR-022: the owner's call, 2026-11-09); a file already copied from the
 * same address is kept.
 *
 *   pnpm exec tsx scripts/media/fetch-rsi.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ConceptSource,
  RSI_IMAGE_SIZE,
  RSI_ORIGIN,
  RSI_SPACING_MS,
  RsiSource,
  SHIP_MATRIX_URL,
  createSpacer,
  matchShips,
  originalOf,
} from "./sources.js";
import { rsiUserAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const packDir = join(repoRoot, "fixtures", "bootstrap");
const outDir = join(repoRoot, "fixtures", "rsi-media");

const PackVehicleRow = z.object({
  class_name: z.string(),
  name: z.string(),
  manufacturer_code: z.string(),
});

const ConceptRow = z.object({
  slug: z.string(),
  name: z.string(),
  manufacturer_code: z.string(),
});

const MatrixRow = z.object({
  name: z.string(),
  url: z.string(),
  manufacturer: z.object({ code: z.string() }),
  media: z.array(z.object({ images: z.record(z.string(), z.string()) })),
});
const Matrix = z.object({ data: z.array(MatrixRow.loose()) });

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A copied row still on disk from the same address needs no new request. */
function reusable<T extends { file: string; image_url: string }>(
  previous: readonly T[],
  imageUrl: string,
): T | undefined {
  const row = previous.find((r) => r.image_url === imageUrl);
  return row !== undefined && existsSync(join(outDir, row.file))
    ? row
    : undefined;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  // Each ship's name on RSI's ship matrix, as the wiki records it (VehicleStats raw).
  const matrixNames = new Map(
    z
      .array(
        z.object({
          class_name: z.string(),
          raw: z
            .object({ shipmatrix_name: z.string().nullable().optional() })
            .loose(),
        }),
      )
      .parse(
        JSON.parse(readFileSync(join(packDir, "VehicleStats.json"), "utf8")),
      )
      .map((s) => [s.class_name, s.raw.shipmatrix_name ?? null]),
  );
  const pack = z
    .array(PackVehicleRow)
    .parse(JSON.parse(readFileSync(join(packDir, "Vehicle.json"), "utf8")))
    .map((v) => ({ ...v, matrix_name: matrixNames.get(v.class_name) ?? null }));
  const conceptFile = join(
    repoRoot,
    "fixtures",
    "ship-matrix",
    "ConceptShip.json",
  );
  const concepts = existsSync(conceptFile)
    ? z.array(ConceptRow).parse(JSON.parse(readFileSync(conceptFile, "utf8")))
    : [];
  mkdirSync(outDir, { recursive: true });
  const sourcesPath = join(outDir, "sources.json");
  const conceptSourcesPath = join(outDir, "concept-sources.json");
  const previous: RsiSource[] = existsSync(sourcesPath)
    ? z.array(RsiSource).parse(JSON.parse(readFileSync(sourcesPath, "utf8")))
    : [];
  const previousConcepts: ConceptSource[] = existsSync(conceptSourcesPath)
    ? z
        .array(ConceptSource)
        .parse(JSON.parse(readFileSync(conceptSourcesPath, "utf8")))
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
  /** The original upload (ADR-015), or the listed wallpaper where the original is missing. */
  const download = async (
    imageUrl: string,
    fileStem: string,
  ): Promise<{
    file: string;
    image_url: string;
    content_type: string;
    bytes: number;
    sha256: string;
  }> => {
    const original = originalOf(imageUrl);
    await spacer();
    const first = await fetch(original, {
      headers: { "User-Agent": rsiUserAgent("media") },
    });
    const response = first.ok ? first : await get(imageUrl);
    const used = first.ok ? original : imageUrl;
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim();
    const extension = EXTENSIONS[contentType];
    if (extension === undefined) {
      throw new Error(`${used}: unexpected type ${contentType}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = `${fileStem}.${extension}`;
    writeFileSync(join(outDir, file), bytes);
    return {
      file,
      image_url: used,
      content_type: contentType,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  };

  const matrix = Matrix.parse(await (await get(SHIP_MATRIX_URL)).json()).data;
  const { matched, unmatched } = matchShips(pack, matrix);
  const rows: RsiSource[] = [];
  let reused = 0;
  for (const match of matched) {
    const kept =
      reusable(previous, match.imageUrl) ??
      reusable(previous, originalOf(match.imageUrl));
    if (kept !== undefined) {
      // The file is shared (an edition and its base match the same row); the row is this ship's.
      rows.push({ ...kept, class_name: match.vehicle.class_name });
      reused += 1;
      continue;
    }
    const copied = await download(match.imageUrl, match.vehicle.class_name);
    rows.push(
      RsiSource.parse({
        class_name: match.vehicle.class_name,
        page_url: match.pageUrl,
        fetched_at: new Date().toISOString(),
        ...copied,
      }),
    );
  }
  rows.sort((a, b) => a.class_name.localeCompare(b.class_name));
  writeFileSync(sourcesPath, `${JSON.stringify(rows, null, 2)}\n`);

  // Concept ships (ADR-022): the same matrix row by name and maker, keyed by the concept's slug.
  const conceptRows: ConceptSource[] = [];
  const conceptsUnmatched: { slug: string; reason: string }[] = [];
  for (const concept of concepts) {
    const candidates = matrix.filter(
      (row) =>
        row.name === concept.name &&
        row.manufacturer.code === concept.manufacturer_code,
    );
    const row = candidates.length === 1 ? candidates[0] : undefined;
    const imageUrl = row?.media[0]?.images[RSI_IMAGE_SIZE];
    if (
      row === undefined ||
      imageUrl === undefined ||
      !imageUrl.startsWith("https://")
    ) {
      conceptsUnmatched.push({
        slug: concept.slug,
        reason:
          row === undefined
            ? `${candidates.length} ship-matrix rows`
            : `no ${RSI_IMAGE_SIZE} image`,
      });
      continue;
    }
    const kept =
      reusable(previousConcepts, imageUrl) ??
      reusable(previousConcepts, originalOf(imageUrl));
    if (kept !== undefined) {
      conceptRows.push({ ...kept, slug: concept.slug });
      reused += 1;
      continue;
    }
    const copied = await download(imageUrl, `concept-${concept.slug}`);
    conceptRows.push(
      ConceptSource.parse({
        slug: concept.slug,
        page_url: new URL(row.url, RSI_ORIGIN).toString(),
        fetched_at: new Date().toISOString(),
        ...copied,
      }),
    );
  }
  conceptRows.sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(
    conceptSourcesPath,
    `${JSON.stringify(conceptRows, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-rsi",
      in: pack.length + concepts.length,
      out: rows.length + conceptRows.length,
      reused,
      unmatched: [
        ...unmatched.map((u) => ({
          class_name: u.vehicle.class_name,
          reason: u.reason,
        })),
        ...conceptsUnmatched,
      ],
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

await main();
