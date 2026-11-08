/**
 * Builds the site's web copies of ship images and maker logos in `apps/web/public/media/`
 * (git-ignored) and the manifest the site reads to know which exist (ADR-009).
 *
 * Inputs, both git-ignored and optional: `fixtures/rsi-media/` from `fetch-rsi.ts`, and the
 * fankit unpacked into `fixtures/fankit/` (its `03_LOGOS` folder). A missing input simply means
 * fewer images; the site works with none. No network.
 *
 * Images are resized and re-encoded only: never cropped, recolored, flipped or retouched (fankit
 * guidelines, section 3). Logos lose their transparent margin and nothing else.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
 */
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MediaManifest, type MakerLogo, type ShipImage } from "schema";
import sharp from "sharp";
import { z } from "zod";
import {
  FANKIT_LOGOS,
  LOGO_HEIGHT,
  RsiSource,
  SHIP_WIDTHS,
  logoRenditionPath,
  shipRenditionPath,
} from "./sources.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const rsiDir = join(repoRoot, "fixtures", "rsi-media");
const fankitDir = join(repoRoot, "fixtures", "fankit");
const publicDir = join(repoRoot, "apps", "web", "public");
const mediaDir = join(publicDir, "media");

const fileFor = (src: string): string =>
  join(publicDir, ...src.split("/").filter(Boolean));

async function ships(): Promise<ShipImage[]> {
  const sourcesFile = join(rsiDir, "sources.json");
  if (!existsSync(sourcesFile)) return [];
  const rows = z
    .array(RsiSource)
    .parse(JSON.parse(readFileSync(sourcesFile, "utf8")));
  const out: ShipImage[] = [];
  for (const row of rows) {
    const input = join(rsiDir, row.file);
    if (!existsSync(input)) continue;
    const meta = await sharp(input).metadata();
    const renditions = [];
    for (const width of SHIP_WIDTHS) {
      if (
        meta.width === undefined ||
        meta.height === undefined ||
        width > meta.width
      )
        continue;
      const src = shipRenditionPath(row.class_name, width);
      const info = await sharp(input)
        .resize({ width })
        .webp({ quality: width >= 1280 ? 78 : 74 })
        .toFile(fileFor(src));
      renditions.push({ src, width: info.width, height: info.height });
    }
    if (renditions.length === 0) continue;
    out.push({
      class_name: row.class_name,
      source: "rsi_ship_matrix",
      page_url: row.page_url,
      image_url: row.image_url,
      fetched_at: row.fetched_at,
      renditions,
    });
  }
  return out;
}

/** The newest unpacked kit, for example `fixtures/fankit/Fankit_2025_11_19`. */
function fankitRoot(): { dir: string; version: string } | null {
  if (!existsSync(fankitDir)) return null;
  const kits = readdirSync(fankitDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^Fankit_\d{4}_\d{2}_\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  const latest = kits.at(-1);
  return latest === undefined
    ? null
    : { dir: join(fankitDir, latest), version: latest.replace(/^Fankit_/, "") };
}

async function logo(input: string, src: string) {
  const info = await sharp(input)
    .trim()
    .resize({ height: LOGO_HEIGHT })
    .webp({ lossless: true })
    .toFile(fileFor(src));
  return { src, width: info.width, height: info.height };
}

async function makers(): Promise<MakerLogo[]> {
  const kit = fankitRoot();
  if (kit === null) return [];
  const logos = join(kit.dir, "03_LOGOS");
  const out: MakerLogo[] = [];
  for (const [code, files] of Object.entries(FANKIT_LOGOS)) {
    const onLight = join(logos, files.onLight);
    if (!existsSync(onLight)) continue;
    const onDark = files.onDark === null ? null : join(logos, files.onDark);
    out.push({
      manufacturer_code: code,
      source: "fankit",
      fankit_version: kit.version,
      on_light: await logo(onLight, logoRenditionPath(code, "light")),
      on_dark:
        onDark === null || !existsSync(onDark)
          ? null
          : await logo(onDark, logoRenditionPath(code, "dark")),
    });
  }
  return out;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  rmSync(mediaDir, { recursive: true, force: true });
  mkdirSync(join(mediaDir, "ships"), { recursive: true });
  mkdirSync(join(mediaDir, "makers"), { recursive: true });
  const manifest = MediaManifest.parse({
    generated_at: new Date().toISOString(),
    ships: await ships(),
    makers: await makers(),
  });
  writeFileSync(
    join(mediaDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:prepare",
      ships: manifest.ships.length,
      makers: manifest.makers.length,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

await main();
