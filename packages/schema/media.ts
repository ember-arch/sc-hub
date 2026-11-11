import { z } from "zod";
import { ClassName, ManufacturerCode, Timestamp } from "./common.js";
import { TitleIconMedia } from "./entities/title.js";

/**
 * The media manifest (ADR-009): which images exist for which entities, written by
 * `scripts/media/prepare.ts` next to the web copies it builds and read by the site. Every entry
 * names where its image came from. Ship images come from RSI's public ship matrix, matched to the
 * pack by exact name and manufacturer code; maker logos come from the fankit, matched by name.
 * Nothing here is chosen by eye.
 */

/** One web copy of an image, a static file served from `/media/`. */
export const MediaRendition = z.strictObject({
  src: z.string().regex(/^\/media\/[a-z0-9/_.-]+$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type MediaRendition = z.infer<typeof MediaRendition>;

export const ShipImage = z.strictObject({
  class_name: ClassName,
  source: z.literal("rsi_ship_matrix"),
  /** The ship's own page on robertsspaceindustries.com. */
  page_url: z.url(),
  /** The image as RSI serves it. */
  image_url: z.url(),
  fetched_at: Timestamp,
  /** Widest first. */
  renditions: z.array(MediaRendition).min(1),
});
export type ShipImage = z.infer<typeof ShipImage>;

/**
 * A concept ship's image from RSI's ship matrix (ADR-022), keyed by the concept's slug since it
 * has no class name yet. Local only, like every image here.
 */
export const ConceptImage = z.strictObject({
  slug: z.string().min(1),
  source: z.literal("rsi_ship_matrix"),
  page_url: z.url(),
  image_url: z.url(),
  fetched_at: Timestamp,
  /** Widest first. */
  renditions: z.array(MediaRendition).min(1),
});
export type ConceptImage = z.infer<typeof ConceptImage>;

export const MakerLogo = z.strictObject({
  manufacturer_code: ManufacturerCode,
  source: z.literal("fankit"),
  fankit_version: z.string().min(1),
  /** The dark mark, for light backgrounds. */
  on_light: MediaRendition,
  /** The light mark, for dark backgrounds; null when the fankit has none (logos are never recolored). */
  on_dark: MediaRendition.nullable(),
});
export type MakerLogo = z.infer<typeof MakerLogo>;

/** One image in a showcase, with its web renditions (widest first). */
export const ShowcaseImage = z.strictObject({
  key: z.string().min(1),
  renditions: z.array(MediaRendition).min(1),
  has_alpha: z.boolean(),
});
export type ShowcaseImage = z.infer<typeof ShowcaseImage>;

export const ShowcaseVideo = z.strictObject({
  key: z.string().min(1),
  src: z.string().regex(/^\/media\/[a-z0-9/_.-]+\.mp4$/),
  poster: z.string().min(1).nullable(),
  /** The loop's own picture size, so it shows whole at its proportions (ADR-015). */
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
});
export type ShowcaseVideo = z.infer<typeof ShowcaseVideo>;

/** A chapter of the ship's own article: CIG's heading, kicker and text, verbatim. */
export const ShowcaseChapter = z.strictObject({
  heading: z.string().min(1),
  kicker: z.string().nullable(),
  text: z.array(z.string().min(1)),
  image: z.string().nullable(),
  video: z.string().nullable(),
});
export type ShowcaseChapter = z.infer<typeof ShowcaseChapter>;

/**
 * A figure in a ship file section (ADR-014): an image or render loop placed where it informs,
 * with a phone layout for schematics and a caption.
 */
export const ShowcaseFigure = z.strictObject({
  section: z.enum([
    "brief",
    "acquisition",
    "operations",
    "combat",
    "mobility",
    "scale",
    "specifications",
    "hardpoints",
  ]),
  kind: z.enum(["image", "video"]),
  /** An image key, or a video key for a render loop. */
  key: z.string().min(1),
  /** An image key laid out for phones, or null. */
  narrow: z.string().nullable(),
  caption: z.string().min(1),
});
export type ShowcaseFigure = z.infer<typeof ShowcaseFigure>;

/**
 * A showcase ship (ADR-010): the owner's concept hero (Anvil Odin) and live example (RSI Perseus).
 * Built by `scripts/media/prepare.ts` from `fixtures/showcase/<slug>/`, all git-ignored.
 */
export const Showcase = z.strictObject({
  slug: z.string().min(1),
  article: z
    .strictObject({
      title: z.string(),
      url: z.url(),
      published_at: Timestamp,
    })
    .nullable(),
  /** The wiki article whose gallery the pictures come from (ADR-024); null for a curated showcase. */
  wiki_article: z.url().nullable().default(null),
  images: z.array(ShowcaseImage),
  videos: z.array(ShowcaseVideo),
  /** Superseded by the RSI holoviewer models in `MediaManifest.holo` (ADR-015); always null now. */
  model: z
    .strictObject({
      src: z.string().regex(/^\/media\/[a-z0-9/_.-]+\.glb$/),
      bytes: z.number().int().positive(),
    })
    .nullable(),
  /** Roles name the images the page places: hero background, hero ship cut-out, header, logo. */
  roles: z.record(z.string(), z.string()),
  chapters: z.array(ShowcaseChapter),
  gallery: z.array(z.string()),
  schematics: z.array(
    z.strictObject({
      wide: z.string(),
      narrow: z.string().nullable(),
      caption: z.string(),
    }),
  ),
  /** The ship file's figures in section order (ADR-014); absent in manifests built before it. */
  figures: z.array(ShowcaseFigure).default([]),
});
export type Showcase = z.infer<typeof Showcase>;

/**
 * A ship's RSI holoviewer model (ADR-015): the OpenCTM file its RSI pledge page loads, packed by
 * `scripts/media/prepare.ts` into a meshopt-compressed glTF in metres.
 */
export const HoloModel = z.strictObject({
  slug: z.string().min(1),
  src: z.string().regex(/^\/media\/holo\/[a-z0-9-]+\.glb$/),
  bytes: z.number().int().positive(),
  /** The RSI pledge page whose holoviewer shows it. */
  page: z.url(),
  /** Width, height and length in metres. */
  size: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
  vertices: z.number().int().positive(),
  triangles: z.number().int().positive(),
});
export type HoloModel = z.infer<typeof HoloModel>;

/** The human figure RSI's holoviewer stands beside every ship, packed the same way. */
export const HoloFigure = z.strictObject({
  src: z.string().regex(/^\/media\/holo\/[a-z0-9-]+\.glb$/),
  bytes: z.number().int().positive(),
  /** In metres. */
  height: z.number().positive(),
});
export type HoloFigure = z.infer<typeof HoloFigure>;

/**
 * A Comm-Link's cover (ADR-029): the picture RSI's Comm-Link hub shows for the transmission,
 * copied by `scripts/media/fetch-covers.ts` and keyed by RSI's own id for the Comm-Link, the
 * `external_id` of the content item. Local only, like every image here.
 */
export const CoverImage = z.strictObject({
  external_id: z.string().min(1),
  source: z.literal("rsi_comm_link_hub"),
  /** The Comm-Link's own page on robertsspaceindustries.com. */
  page_url: z.url(),
  /** The cover as RSI serves it. */
  image_url: z.url(),
  fetched_at: Timestamp,
  /** Widest first. */
  renditions: z.array(MediaRendition).min(1),
});
export type CoverImage = z.infer<typeof CoverImage>;

/**
 * A picture in a developer post (ADR-036): an upload CIG staff attached to a Spectrum post,
 * copied by `scripts/media/fetch-spectrum.ts` at its uploaded size and keyed by Spectrum's own
 * upload id, which the post's `body_html` carries as `data-upload` on its `img`. Credited to Cloud
 * Imperium Games, via Spectrum, and linked to the post.
 */
export const SpectrumImage = z.strictObject({
  upload_id: z.string().regex(/^\d+$/),
  source: z.literal("spectrum_upload"),
  /** The post the picture was attached to, on Spectrum. */
  page_url: z.url(),
  /** The upload as Spectrum serves it. */
  image_url: z.url(),
  fetched_at: Timestamp,
  /** Widest first. */
  renditions: z.array(MediaRendition).min(1),
});
export type SpectrumImage = z.infer<typeof SpectrumImage>;

export const MediaManifest = z.strictObject({
  generated_at: Timestamp,
  ships: z.array(ShipImage),
  makers: z.array(MakerLogo),
  showcase: z.array(Showcase).default([]),
  holo: z.array(HoloModel).default([]),
  holo_figure: HoloFigure.nullable().default(null),
  /** Title icons (ADR-017), from `fixtures/titles-media/`; absent in manifests built before it. */
  titles: z.array(TitleIconMedia).default([]),
  /** Concept ships' images (ADR-022), by slug; absent in manifests built before it. */
  concepts: z.array(ConceptImage).default([]),
  /** Comm-Link covers (ADR-029), by RSI's id for the Comm-Link; absent in manifests built before it. */
  covers: z.array(CoverImage).default([]),
  /** Pictures in developer posts (ADR-036), by Spectrum's upload id; absent in manifests built before it. */
  spectrum: z.array(SpectrumImage).default([]),
});
export type MediaManifest = z.infer<typeof MediaManifest>;
