import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ConceptShip,
  type Showcase,
  type ShowcaseFigure,
  type ShowcaseImage,
} from "schema";
import { REPO_ROOT } from "./data";
import { media } from "./media";

/**
 * The showcase layer (ADR-010): the owner's concept hero (Anvil Odin) and live example (RSI
 * Perseus) get CIG's art, videos, story chapters and an interactive 3D model. Everything comes from
 * the media manifest (git-ignored, local) except the Odin's published figures, which are committed
 * in fixtures/ship-matrix so its page exists everywhere.
 */

export interface Picture {
  readonly src: string;
  readonly srcSet: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface ChapterView {
  readonly heading: string;
  readonly kicker: string | null;
  readonly text: readonly string[];
  readonly image: Picture | null;
  readonly video: {
    readonly src: string;
    readonly poster: string | null;
  } | null;
}

/** A figure in a ship file section (ADR-014). */
export type FigureView =
  | {
      readonly kind: "image";
      readonly picture: Picture;
      /** A layout for phones (schematics), or null. */
      readonly narrow: Picture | null;
      readonly caption: string;
    }
  | {
      readonly kind: "video";
      readonly src: string;
      readonly poster: string | null;
      /** The loop's own size, null when unknown (it then fills a 16:9 frame). */
      readonly width: number | null;
      readonly height: number | null;
      readonly caption: string;
    };

export type FigureSection = ShowcaseFigure["section"];

export interface ShowcaseView {
  readonly slug: string;
  readonly article: Showcase["article"];
  readonly background: Picture | null;
  readonly cutout: Picture | null;
  readonly poster: Picture | null;
  readonly topdown: Picture | null;
  readonly intro: ChapterView | null;
  readonly chapters: readonly ChapterView[];
  readonly gallery: readonly Picture[];
  readonly schematics: readonly {
    readonly wide: Picture;
    readonly narrow: Picture | null;
    readonly caption: string;
  }[];
  /** Each section's figures, the first leading the section (ADR-014). */
  readonly figures: Readonly<
    Partial<Record<FigureSection, readonly FigureView[]>>
  >;
}

export function picture(image: ShowcaseImage, alt: string): Picture {
  const widest = image.renditions[0]!;
  const fallback = image.renditions.find((r) => r.width <= 1600) ?? widest;
  return {
    src: fallback.src,
    srcSet: image.renditions.map((r) => `${r.src} ${r.width}w`).join(", "),
    width: widest.width,
    height: widest.height,
    alt,
  };
}

/** "THE ALL-KILLING EYE" → "The all-killing eye" (CLAUDE.md section 7: sentence case). */
export function sentenceCase(heading: string): string {
  const lower = heading.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function buildShowcase(raw: Showcase, name: string): ShowcaseView {
  const byKey = new Map(raw.images.map((i) => [i.key, i]));
  const img = (key: string | null | undefined, alt: string): Picture | null => {
    if (key === null || key === undefined) return null;
    const image = byKey.get(key);
    return image === undefined ? null : picture(image, alt);
  };
  const posterOf = (key: string | null): string | null => {
    const image = key === null ? undefined : byKey.get(key);
    return image === undefined ? null : picture(image, "").src;
  };
  const chapters: ChapterView[] = raw.chapters.map((c) => {
    const video =
      c.video === null ? undefined : raw.videos.find((v) => v.key === c.video);
    return {
      heading: sentenceCase(c.heading),
      kicker: c.kicker,
      text: c.text,
      image: img(c.image, `${name}: ${c.kicker ?? sentenceCase(c.heading)}`),
      video:
        video === undefined
          ? null
          : { src: video.src, poster: posterOf(video.poster) },
    };
  });
  // The first chapter without media is the article's opening: it belongs to the hero.
  const intro =
    chapters[0] !== undefined &&
    chapters[0].image === null &&
    chapters[0].video === null
      ? chapters[0]
      : null;
  const figures: Partial<Record<FigureSection, FigureView[]>> = {};
  for (const f of raw.figures) {
    let view: FigureView | null = null;
    if (f.kind === "video") {
      const video = raw.videos.find((v) => v.key === f.key);
      if (video !== undefined)
        view = {
          kind: "video",
          src: video.src,
          poster: posterOf(video.poster),
          width: video.width,
          height: video.height,
          caption: f.caption,
        };
    } else {
      const alt = `${name}: ${f.caption.toLowerCase()}`;
      const wide = img(f.key, alt);
      if (wide !== null)
        view = {
          kind: "image",
          picture: wide,
          narrow: img(f.narrow, alt),
          caption: f.caption,
        };
    }
    if (view !== null) (figures[f.section] ??= []).push(view);
  }
  return {
    slug: raw.slug,
    article: raw.article,
    background: img(
      raw.roles["background"] ?? raw.roles["header"],
      `${name}, key art`,
    ),
    cutout: img(raw.roles["cutout"], ""),
    poster: img(raw.roles["poster"], `${name}`),
    topdown: img(raw.roles["topdown"], `${name} seen from above`),
    intro,
    chapters: intro === null ? chapters : chapters.slice(1),
    gallery: raw.gallery
      .map((key, i) => img(key, `${name}, image ${i + 1}`))
      .filter((p): p is Picture => p !== null),
    schematics: raw.schematics.flatMap((s) => {
      const wide = img(s.wide, `${name}: ${s.caption}`);
      return wide === null
        ? []
        : [
            {
              wide,
              narrow: img(s.narrow, `${name}: ${s.caption}`),
              caption: s.caption,
            },
          ];
    }),
    figures,
  };
}

export function showcaseFor(slug: string, name: string): ShowcaseView | null {
  const raw = media().showcase(slug);
  return raw === null ? null : buildShowcase(raw, name);
}

const CONCEPT_FILE = join(
  REPO_ROOT,
  "fixtures",
  "ship-matrix",
  "ConceptShip.json",
);

let concepts: readonly ConceptShip[] | undefined;

/** Ships CIG has published but the game does not contain yet, with RSI's figures. */
export function conceptShips(): readonly ConceptShip[] {
  concepts ??= existsSync(CONCEPT_FILE)
    ? ConceptShip.array().parse(JSON.parse(readFileSync(CONCEPT_FILE, "utf8")))
    : [];
  return concepts;
}

export function conceptBySlug(slug: string): ConceptShip | undefined {
  return conceptShips().find((c) => c.slug === slug);
}

export const SHOWCASE_CREDITS = {
  rsi: "Roberts Space Industries",
  /** A model's own credit names its RSI pledge page (ADR-015); this is the fallback. */
  model: {
    text: "Model: RSI holoviewer",
    href: "https://robertsspaceindustries.com/pledge",
  },
} as const;
