/**
 * Copies RSI's official image for each ship in the bootstrap pack into `fixtures/rsi-media/`
 * (git-ignored) and records where each came from in `fixtures/rsi-media/sources.json` (ADR-009).
 *
 * One request for the public ship matrix, then one per matched ship, at least 5 seconds apart
 * (CLAUDE.md section 9), without cookies or a signed-in session. It fetches only the pack's ships:
 * RSI's terms forbid scraping and harvesting, so widening this to every ship is the owner's call.
 *
 *   pnpm exec tsx scripts/media/fetch-rsi.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
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

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const pack = z
    .array(PackVehicleRow)
    .parse(JSON.parse(readFileSync(join(packDir, "Vehicle.json"), "utf8")));
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

  const matrix = Matrix.parse(await (await get(SHIP_MATRIX_URL)).json()).data;
  const { matched, unmatched } = matchShips(pack, matrix);
  mkdirSync(outDir, { recursive: true });
  const rows: RsiSource[] = [];
  for (const match of matched) {
    // The original upload (ADR-015), or the listed wallpaper where the original is missing.
    const original = originalOf(match.imageUrl);
    await spacer();
    const first = await fetch(original, {
      headers: { "User-Agent": rsiUserAgent("media") },
    });
    const response = first.ok ? first : await get(match.imageUrl);
    const imageUrl = first.ok ? original : match.imageUrl;
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim();
    const extension = EXTENSIONS[contentType];
    if (extension === undefined) {
      throw new Error(`${imageUrl}: unexpected type ${contentType}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = `${match.vehicle.class_name}.${extension}`;
    writeFileSync(join(outDir, file), bytes);
    rows.push(
      RsiSource.parse({
        class_name: match.vehicle.class_name,
        file,
        page_url: match.pageUrl,
        image_url: imageUrl,
        content_type: contentType,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        fetched_at: new Date().toISOString(),
      }),
    );
  }
  rows.sort((a, b) => a.class_name.localeCompare(b.class_name));
  writeFileSync(
    join(outDir, "sources.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-rsi",
      in: pack.length,
      out: rows.length,
      unmatched: unmatched.map((u) => ({
        class_name: u.vehicle.class_name,
        reason: u.reason,
      })),
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

await main();
