/**
 * A ship's gallery on the Star Citizen Wiki (ADR-024): the "Gallery" section of its article, with
 * an "Official" tab of RSI's art and an "In-game" tab of screenshots, each thumbnail linking the
 * original upload on the wiki's media host. Read from the article page only (ADR-017: article
 * pages and uploads, never the API), one request every five seconds. Pure; tested on a committed
 * sample of the Gladius article's gallery section.
 */
import { z } from "zod";
import { attributes, decodeEntities } from "../titles/html.js";

export const WIKI_ORIGIN = "https://starcitizen.tools";

/** One ship's row in `fixtures/galleries/sources.json`. */
export const GallerySource = z.strictObject({
  slug: z.string().min(1),
  name: z.string().min(1),
  article_url: z.url(),
  status: z.enum(["gallery", "no-gallery", "no-article"]),
  items: z.array(
    z.strictObject({
      file: z.string().min(1),
      url: z.url(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      kind: z.enum(["official", "ingame"]),
      bytes: z.number().int().positive(),
      sha256: z.string().length(64),
    }),
  ),
  fetched_at: z.iso.datetime(),
});
export type GallerySource = z.infer<typeof GallerySource>;

export interface GalleryItem {
  /** The upload's title on the wiki, for example "Gladius_-_Take_off.jpg". */
  readonly file: string;
  /** The original upload. */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly kind: "official" | "ingame";
}

export class GalleryShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GalleryShapeError";
  }
}

/** The article a pack ship or concept ship has on the wiki, from its display name. */
export function articleUrl(name: string): string {
  return `${WIKI_ORIGIN}/${encodeURIComponent(name.trim().replace(/ /g, "_"))}`;
}

/** The two tabs of the Gallery section, in the article's order; empty when the article has none. */
export function parseGallery(html: string): {
  official: GalleryItem[];
  ingame: GalleryItem[];
} {
  const start = html.indexOf('id="Gallery"');
  if (start < 0) return { official: [], ingame: [] };
  const section = html.slice(start);
  const tab = (id: string, kind: GalleryItem["kind"]): GalleryItem[] => {
    const at = section.indexOf(`id="tabber-${id}"`);
    if (at < 0) return [];
    // A tab panel ends where the next panel or the section's end begins.
    const rest = section.slice(at);
    const next = rest.indexOf('class="tabber__panel"', 1);
    const panel = next < 0 ? rest : rest.slice(0, next);
    return parseItems(panel, kind);
  };
  return {
    official: tab("Official", "official"),
    ingame: tab("In-game", "ingame"),
  };
}

function parseItems(panel: string, kind: GalleryItem["kind"]): GalleryItem[] {
  const items: GalleryItem[] = [];
  const seen = new Set<string>();
  // Each image: a File: link around a <picture> with the thumbnail, then the source link.
  const re =
    /<a href="\/File:([^"]+)" class="mw-file-description">([\s\S]*?)<\/a>\s*<a href="([^"]+)" class="mw-file-source"/g;
  for (const m of panel.matchAll(re)) {
    const file = decodeEntities(m[1]!);
    const img = m[2]!.match(/<img\b[^>]*>/)?.[0];
    if (img === undefined) continue;
    const a = attributes(img);
    const width = Number(a["data-file-width"]);
    const height = Number(a["data-file-height"]);
    const url = decodeEntities(m[3]!).replace(/\?.*$/, "");
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) {
      throw new GalleryShapeError(`${file}: no file size on its thumbnail`);
    }
    if (!url.startsWith("https://media.starcitizen.tools/")) {
      throw new GalleryShapeError(
        `${file}: source off the wiki's media host: ${url}`,
      );
    }
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ file, url, width, height, kind });
  }
  return items;
}

/** Which uploads to copy: the first `official` of RSI's art, then up to `ingame` screenshots. */
export function chooseItems(
  gallery: { official: readonly GalleryItem[]; ingame: readonly GalleryItem[] },
  limits: { official: number; ingame: number },
): GalleryItem[] {
  // Decorative uploads (logos, icons, animated files) are not pictures of the ship.
  const picture = (i: GalleryItem): boolean =>
    /\.(jpe?g|png|webp)$/i.test(i.file) &&
    !/logo|icon|badge|lockup|emblem/i.test(i.file) &&
    i.width >= 600;
  return [
    ...gallery.official.filter(picture).slice(0, limits.official),
    ...gallery.ingame.filter(picture).slice(0, limits.ingame),
  ];
}

/**
 * A gallery picture's caption says what kind of picture it is, no more: the wiki's file titles are
 * uploaders' shorthand ("3.2 sale stalker 11, squashed"), not CIG's labels, and a caption must not
 * invent a description. The credit beside the cover names the source (ADR-024).
 */
export function captionFor(
  kind: GalleryItem["kind"],
  shipName: string,
): string {
  return kind === "official"
    ? `${shipName}, official art`
    : `${shipName}, in the game`;
}

/** The ship file's sections that take a lead figure, in the order the pictures are dealt. */
export const DEALT_SECTIONS = [
  "brief",
  "combat",
  "operations",
  "mobility",
  "hardpoints",
  "specifications",
  "acquisition",
] as const;

export interface Composition {
  readonly roles: Readonly<Record<string, string>>;
  readonly figures: readonly {
    readonly section: (typeof DEALT_SECTIONS)[number];
    readonly key: string;
    readonly caption: string;
  }[];
  readonly gallery: readonly string[];
}

/**
 * How a ship page places a gallery it was not curated for (ADR-024): the first official picture
 * is the cover, the second the poster; the next pictures lead the file's sections in order; the
 * rest stand in the gallery. Keys are the image keys the media build assigns.
 */
export function composeShowcase(
  items: readonly { key: string; caption: string; kind: GalleryItem["kind"] }[],
): Composition {
  const [cover, poster, ...rest] = items;
  if (cover === undefined) return { roles: {}, figures: [], gallery: [] };
  const roles: Record<string, string> = { background: cover.key };
  roles["poster"] = (poster ?? cover).key;
  const dealt = rest.slice(0, DEALT_SECTIONS.length);
  const figures = dealt.map((item, i) => ({
    section: DEALT_SECTIONS[i]!,
    key: item.key,
    caption: item.caption,
  }));
  const gallery = [
    ...(poster === undefined ? [] : [poster.key]),
    ...rest.slice(DEALT_SECTIONS.length).map((i) => i.key),
  ];
  return { roles, figures, gallery };
}
