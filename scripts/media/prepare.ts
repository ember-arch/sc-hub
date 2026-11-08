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
import { createRequire } from "node:module";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MediaManifest,
  type MakerLogo,
  type ShipImage,
  type Showcase,
} from "schema";
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
import { parseArticle } from "./article.js";
import { SHOWCASE } from "./showcase.js";

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

/** Widest first; never upscaled. */
const SHOWCASE_WIDTHS: readonly number[] = [2560, 1600, 960, 640];

const keyOf = (file: string): string =>
  file
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface ArticleFile {
  title: string;
  url: string;
  published_at: string;
  text: string;
}

/** The showcase ships (ADR-010): web copies of their art, videos and models, and their chapters. */
async function showcases(): Promise<Showcase[]> {
  const out: Showcase[] = [];
  for (const ship of SHOWCASE) {
    const dir = join(repoRoot, "fixtures", "showcase", ship.slug);
    if (!existsSync(dir)) continue;
    mkdirSync(join(mediaDir, "showcase", ship.slug), { recursive: true });
    const has = (file: string): boolean => existsSync(join(dir, file));
    const images: Showcase["images"] = [];
    for (const item of ship.files.filter(
      (f) => f.kind === "image" && has(f.file),
    )) {
      const input = join(dir, item.file);
      const meta = await sharp(input).metadata();
      const width = meta.width ?? 0;
      const widths = SHOWCASE_WIDTHS.filter((w) => w <= width);
      if (widths.length === 0) widths.push(width);
      const key = keyOf(item.file);
      const renditions = [];
      for (const w of widths) {
        const src = `/media/showcase/${ship.slug}/${key}-${w}.webp`;
        const info = await sharp(input)
          .resize({ width: w })
          .webp({ quality: w >= 1600 ? 80 : 76, alphaQuality: 90 })
          .toFile(fileFor(src));
        renditions.push({ src, width: info.width, height: info.height });
      }
      images.push({ key, renditions, has_alpha: meta.hasAlpha === true });
    }
    const imageKey = (file: string | undefined): string | null => {
      if (file === undefined) return null;
      const key = keyOf(file);
      return images.some((i) => i.key === key) ? key : null;
    };
    const videos: Showcase["videos"] = [];
    for (const item of ship.files.filter(
      (f) => f.kind === "video" && has(f.file),
    )) {
      const key = keyOf(item.file);
      const src = `/media/showcase/${ship.slug}/${key}.mp4`;
      copyFileSync(join(dir, item.file), fileFor(src));
      // A chapter's own image is the poster when the video has no frame of its own.
      const chapter = ship.layout.chapters.find((c) => c.video === item.file);
      videos.push({
        key,
        src,
        poster:
          imageKey(item.file.replace(/\.mp4$/i, ".jpg")) ??
          imageKey(chapter?.image),
      });
    }
    const videoKey = (file: string | undefined): string | null => {
      if (file === undefined) return null;
      const key = keyOf(file);
      return videos.some((v) => v.key === key) ? key : null;
    };
    const modelFile = ship.files.find((f) => f.kind === "model" && has(f.file));
    let model: Showcase["model"] = null;
    if (modelFile !== undefined) {
      const src = `/media/showcase/${ship.slug}/${keyOf(modelFile.file)}.glb`;
      copyFileSync(join(dir, modelFile.file), fileFor(src));
      model = { src, bytes: statSync(join(dir, modelFile.file)).size };
    }
    const articlePath = join(dir, "article.json");
    const article: ArticleFile | null = existsSync(articlePath)
      ? (JSON.parse(readFileSync(articlePath, "utf8")) as ArticleFile)
      : null;
    const parsed =
      article === null
        ? []
        : parseArticle(
            article.text,
            ship.layout.chapters.map((c) => c.heading),
          );
    const roles: Record<string, string> = {};
    for (const [role, file] of Object.entries(ship.layout.roles)) {
      const key = imageKey(file);
      if (key !== null) roles[role] = key;
    }
    const schematics: Showcase["schematics"] = [];
    for (const sch of ship.layout.schematics) {
      const wide = imageKey(sch.wide);
      if (wide !== null)
        schematics.push({
          wide,
          narrow: imageKey(sch.narrow),
          caption: sch.caption,
        });
    }
    out.push({
      slug: ship.slug,
      article:
        article === null
          ? null
          : {
              title: article.title,
              url: article.url,
              published_at: article.published_at,
            },
      images,
      videos,
      model,
      roles,
      chapters: parsed.map((c) => {
        const layout = ship.layout.chapters.find(
          (l) => l.heading === c.heading,
        );
        return {
          heading: c.heading,
          kicker: c.kicker,
          text: [...c.text],
          image: imageKey(layout?.image),
          video: videoKey(layout?.video),
        };
      }),
      gallery: ship.layout.gallery
        .map((f) => imageKey(f))
        .filter((k): k is string => k !== null),
      schematics,
    });
  }
  return out;
}

/**
 * The 3D models are Draco-compressed. The holoviewer (ADR-012) loads three's decoder from
 * /media/draco/, copied here, so a model page makes no third-party request.
 */
function copyDracoDecoder(): void {
  const require = createRequire(import.meta.url);
  // three does not export its package.json: walk up from its main entry to the package folder.
  const entry = require.resolve("three", {
    paths: [join(repoRoot, "apps", "web")],
  });
  const marker = join("node_modules", "three");
  const three = entry.slice(0, entry.lastIndexOf(marker) + marker.length);
  const from = join(three, "examples", "jsm", "libs", "draco", "gltf");
  const to = join(mediaDir, "draco");
  mkdirSync(to, { recursive: true });
  for (const file of [
    "draco_decoder.wasm",
    "draco_wasm_wrapper.js",
    "draco_decoder.js",
  ]) {
    copyFileSync(join(from, file), join(to, file));
  }
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
    showcase: await showcases(),
  });
  if (manifest.showcase.some((s) => s.model !== null)) copyDracoDecoder();
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
      showcase: manifest.showcase.map(
        (x) =>
          `${x.slug}: ${x.images.length} images, ${x.videos.length} videos, ${x.chapters.length} chapters, model ${x.model === null ? "no" : "yes"}`,
      ),
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

await main();
