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
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type HoloFigure,
  type HoloModel,
  MediaManifest,
  type ConceptImage,
  type CoverImage,
  type MakerLogo,
  type ShipImage,
  type Showcase,
  type SpectrumImage,
} from "schema";
import sharp from "sharp";
import { z } from "zod";
import {
  ConceptSource,
  CoverSource,
  FANKIT_LOGOS,
  LOGO_HEIGHT,
  RsiSource,
  SHIP_WIDTHS,
  SPECTRUM_UPLOAD_WIDTHS,
  SpectrumSource,
  conceptRenditionPath,
  coverRenditionPath,
  logoRenditionPath,
  shipRenditionPath,
  spectrumRenditionPath,
} from "./sources.js";
import { parseArticle } from "./article.js";
import { readCtm } from "./ctm.js";
import { HOLO_FIGURE } from "./holo.js";
import { packHoloModel } from "./holo-glb.js";
import { encodeCoverRenditions } from "./cover-renditions.js";
import { mp4Size } from "./mp4.js";
import { GallerySource, captionFor, composeShowcase } from "./gallery.js";
import { FILE_SECTIONS, SHOWCASE } from "./showcase.js";
import { prepareTitleIcons } from "../titles/prepare-icons.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const rsiDir = join(repoRoot, "fixtures", "rsi-media");
const fankitDir = join(repoRoot, "fixtures", "fankit");
const holoDir = join(repoRoot, "fixtures", "holo");
const titlesDir = join(repoRoot, "fixtures", "titles-media");
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

/** Concept ships' images (ADR-022), the same renditions as the pack's ships, by slug. */
async function concepts(): Promise<ConceptImage[]> {
  const sourcesFile = join(rsiDir, "concept-sources.json");
  if (!existsSync(sourcesFile)) return [];
  const rows = z
    .array(ConceptSource)
    .parse(JSON.parse(readFileSync(sourcesFile, "utf8")));
  const out: ConceptImage[] = [];
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
      const src = conceptRenditionPath(row.slug, width);
      const info = await sharp(input)
        .resize({ width })
        .webp({ quality: width >= 1280 ? 78 : 74 })
        .toFile(fileFor(src));
      renditions.push({ src, width: info.width, height: info.height });
    }
    if (renditions.length === 0) continue;
    out.push({
      slug: row.slug,
      source: "rsi_ship_matrix",
      page_url: row.page_url,
      image_url: row.image_url,
      fetched_at: row.fetched_at,
      renditions,
    });
  }
  return out;
}

/** Comm-Link covers (ADR-029): the same renditions as a card's picture, by RSI's id for the Comm-Link. */
async function covers(): Promise<CoverImage[]> {
  const sourcesFile = join(rsiDir, "cover-sources.json");
  if (!existsSync(sourcesFile)) return [];
  const rows = z
    .array(CoverSource)
    .parse(JSON.parse(readFileSync(sourcesFile, "utf8")));
  const out: CoverImage[] = [];
  for (const row of rows) {
    const input = join(rsiDir, "covers", row.file);
    if (!existsSync(input)) continue;
    // The same encoder as the CI cover step (ADR-051), so both reach the same keys.
    const renditions = [];
    for (const r of await encodeCoverRenditions(readFileSync(input))) {
      const src = coverRenditionPath(row.external_id, r.width);
      writeFileSync(fileFor(src), r.data);
      renditions.push({ src, width: r.width, height: r.height });
    }
    if (renditions.length === 0) continue;
    out.push({
      external_id: row.external_id,
      source: "rsi_comm_link_hub",
      page_url: row.page_url,
      image_url: row.image_url,
      fetched_at: row.fetched_at,
      renditions,
    });
  }
  return out;
}

const spectrumDir = join(repoRoot, "fixtures", "spectrum-media");

/**
 * Pictures in developer posts (ADR-037): web copies at the widths a post's card needs, by
 * Spectrum's upload id; a picture narrower than the smallest width gets one copy at its own size.
 * Resized and re-encoded only, like everything here.
 */
async function spectrum(): Promise<SpectrumImage[]> {
  const sourcesFile = join(spectrumDir, "sources.json");
  if (!existsSync(sourcesFile)) return [];
  const rows = z
    .array(SpectrumSource)
    .parse(JSON.parse(readFileSync(sourcesFile, "utf8")));
  const out: SpectrumImage[] = [];
  for (const row of rows) {
    const input = join(spectrumDir, row.file);
    if (!existsSync(input)) continue;
    const meta = await sharp(input).metadata();
    if (meta.width === undefined || meta.height === undefined) continue;
    const widths = SPECTRUM_UPLOAD_WIDTHS.filter((w) => w <= meta.width!);
    if (widths.length === 0) widths.push(meta.width);
    const renditions = [];
    for (const width of widths) {
      const src = spectrumRenditionPath(row.upload_id, width);
      const info = await sharp(input)
        .resize({ width })
        .webp({ quality: width >= 1280 ? 78 : 74 })
        .toFile(fileFor(src));
      renditions.push({ src, width: info.width, height: info.height });
    }
    out.push({
      upload_id: row.upload_id,
      source: "spectrum_upload",
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
/** 5120 and 3840 keep the full-bleed opening band sharp on 4K and 5K screens (ADR-015). */
const SHOWCASE_WIDTHS: readonly number[] = [5120, 3840, 2560, 1600, 960, 640];

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
      const size = mp4Size(readFileSync(join(dir, item.file)));
      // A chapter's own image is the poster when the video has no frame of its own.
      const chapter = ship.layout.chapters.find((c) => c.video === item.file);
      // Or the still the ship file's figure names for it (ADR-014).
      const figure = Object.values(ship.layout.sections)
        .flat()
        .find((f) => f?.file === item.file && f.poster !== undefined);
      videos.push({
        key,
        src,
        poster:
          imageKey(item.file.replace(/\.mp4$/i, ".jpg")) ??
          imageKey(chapter?.image) ??
          imageKey(figure?.poster),
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
    }
    const videoKey = (file: string | undefined): string | null => {
      if (file === undefined) return null;
      const key = keyOf(file);
      return videos.some((v) => v.key === key) ? key : null;
    };
    // Models come from RSI's holoviewer for every ship now (ADR-015), not per showcase.
    const model: Showcase["model"] = null;
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
    // The ship file's figures (ADR-014): only files that were copied, in section order.
    const figures: Showcase["figures"] = [];
    for (const section of FILE_SECTIONS) {
      for (const fig of ship.layout.sections[section] ?? []) {
        const video = videoKey(fig.file);
        const image = video === null ? imageKey(fig.file) : null;
        if (video === null && image === null) continue;
        figures.push({
          section,
          kind: video === null ? "image" : "video",
          key: video ?? image ?? "",
          narrow: imageKey(fig.narrow),
          caption: fig.caption,
        });
      }
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
      wiki_article: null,
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
      figures,
    });
  }
  return out;
}

const galleriesDir = join(repoRoot, "fixtures", "galleries");

/**
 * A showcase for every ship with a gallery and no curated one (ADR-024): the wiki's copies of
 * RSI's art, rendered like the showcase pair's, composed by rule (`composeShowcase`): cover,
 * poster, one figure per section, the rest in the gallery. A caption says only what kind of
 * picture it is.
 */
async function galleries(curated: ReadonlySet<string>): Promise<Showcase[]> {
  const sourcesPath = join(galleriesDir, "sources.json");
  if (!existsSync(sourcesPath)) return [];
  const rows = z
    .array(GallerySource)
    .parse(JSON.parse(readFileSync(sourcesPath, "utf8")));
  const out: Showcase[] = [];
  for (const row of rows) {
    if (curated.has(row.slug) || row.items.length === 0) continue;
    const dir = join(galleriesDir, row.slug);
    const images: Showcase["images"] = [];
    const composed: {
      key: string;
      caption: string;
      kind: "official" | "ingame";
    }[] = [];
    for (const item of row.items) {
      const input = join(dir, item.file);
      if (!existsSync(input)) continue;
      const key = keyOf(item.file);
      if (images.some((i) => i.key === key)) continue;
      mkdirSync(join(mediaDir, "showcase", row.slug), { recursive: true });
      const meta = await sharp(input).metadata();
      const width = meta.width ?? 0;
      const widths = SHOWCASE_WIDTHS.filter((w) => w <= width);
      if (widths.length === 0) widths.push(width);
      const renditions = [];
      for (const w of widths) {
        const src = `/media/showcase/${row.slug}/${key}-${w}.webp`;
        const info = await sharp(input)
          .resize({ width: w })
          .webp({ quality: w >= 1600 ? 80 : 76, alphaQuality: 90 })
          .toFile(fileFor(src));
        renditions.push({ src, width: info.width, height: info.height });
      }
      images.push({ key, renditions, has_alpha: meta.hasAlpha === true });
      composed.push({
        key,
        caption: captionFor(item.kind, row.name),
        kind: item.kind,
      });
    }
    if (images.length === 0) continue;
    const c = composeShowcase(composed);
    out.push({
      slug: row.slug,
      article: null,
      wiki_article: row.article_url,
      images,
      videos: [],
      model: null,
      roles: c.roles,
      chapters: [],
      gallery: [...c.gallery],
      schematics: [],
      figures: c.figures.map((f) => ({
        section: f.section,
        kind: "image" as const,
        key: f.key,
        narrow: null,
        caption: f.caption,
      })),
    });
  }
  return out;
}

const HoloSource = z.object({
  slug: z.string(),
  file: z.string(),
  page: z.url().nullable(),
});

/**
 * RSI's holoviewer models (ADR-015, ADR-025), copied by `fetch-holo.ts` into `fixtures/holo/`:
 * each file is decoded from OpenCTM once and packed into a meshopt-compressed glTF in metres,
 * named by the file (RSI's media id), so the ship pages that share a model share the packed copy.
 * The human figure RSI stands beside every ship is packed the same way. Nothing on file, nothing
 * written.
 */
async function holoModels(): Promise<{
  holo: HoloModel[];
  figure: HoloFigure | null;
}> {
  const sourcesPath = join(holoDir, "sources.json");
  if (!existsSync(sourcesPath)) return { holo: [], figure: null };
  const rows = z
    .array(HoloSource)
    .parse(JSON.parse(readFileSync(sourcesPath, "utf8")));
  mkdirSync(join(mediaDir, "holo"), { recursive: true });
  const packed = new Map<
    string,
    {
      src: string;
      bytes: number;
      size: readonly [number, number, number];
      vertices: number;
      triangles: number;
    }
  >();
  const pack = async (file: string) => {
    const done = packed.get(file);
    if (done !== undefined) return done;
    const model = await packHoloModel(
      readCtm(readFileSync(join(holoDir, file))),
    );
    const src = `/media/holo/${file.replace(/.ctm$/, "").toLowerCase()}.glb`;
    writeFileSync(fileFor(src), model.glb);
    const entry = {
      src,
      bytes: model.glb.length,
      size: model.size,
      vertices: model.vertices,
      triangles: model.triangles,
    };
    packed.set(file, entry);
    return entry;
  };
  const holo: HoloModel[] = [];
  let figure: HoloFigure | null = null;
  for (const row of rows) {
    if (!existsSync(join(holoDir, row.file))) continue;
    const model = await pack(row.file);
    if (row.slug === HOLO_FIGURE.slug) {
      figure = { src: model.src, bytes: model.bytes, height: model.size[1] };
      continue;
    }
    if (row.page === null) continue;
    holo.push({
      slug: row.slug,
      src: model.src,
      bytes: model.bytes,
      page: row.page,
      size: [...model.size],
      vertices: model.vertices,
      triangles: model.triangles,
    });
  }
  return { holo, figure };
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  rmSync(mediaDir, { recursive: true, force: true });
  mkdirSync(join(mediaDir, "ships"), { recursive: true });
  mkdirSync(join(mediaDir, "makers"), { recursive: true });
  mkdirSync(join(mediaDir, "concepts"), { recursive: true });
  mkdirSync(join(mediaDir, "covers"), { recursive: true });
  mkdirSync(join(mediaDir, "spectrum"), { recursive: true });
  const models = await holoModels();
  const manifest = MediaManifest.parse({
    generated_at: new Date().toISOString(),
    ships: await ships(),
    makers: await makers(),
    showcase: [
      ...(await showcases()),
      ...(await galleries(new Set(SHOWCASE.map((s) => s.slug)))),
    ],
    holo: models.holo,
    holo_figure: models.figure,
    // Title icons (ADR-017): CIG art copied from the wiki, local only like everything here.
    titles: await prepareTitleIcons({
      image: sharp,
      sourcesDir: titlesDir,
      mediaDir,
    }),
    concepts: await concepts(),
    covers: await covers(),
    spectrum: await spectrum(),
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
      concepts: manifest.concepts.length,
      covers: manifest.covers.length,
      spectrum: manifest.spectrum.length,
      makers: manifest.makers.length,
      showcase: manifest.showcase
        .filter((x) => x.wiki_article === null)
        .map(
          (x) =>
            `${x.slug}: ${x.images.length} images, ${x.videos.length} videos, ${x.chapters.length} chapters`,
        ),
      galleries: manifest.showcase.filter((x) => x.wiki_article !== null)
        .length,
      titles: manifest.titles.length,
      holo: manifest.holo.length,
      holo_files: new Set(manifest.holo.map((h) => h.src)).size,
      holo_mb: Number(
        (
          [
            ...new Map(manifest.holo.map((h) => [h.src, h.bytes])).values(),
          ].reduce((a, b) => a + b, 0) / 1e6
        ).toFixed(1),
      ),
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

await main();
