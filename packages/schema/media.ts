import { z } from "zod";
import { ClassName, ManufacturerCode, Timestamp } from "./common.js";

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

export const MediaManifest = z.strictObject({
  generated_at: Timestamp,
  ships: z.array(ShipImage),
  makers: z.array(MakerLogo),
});
export type MediaManifest = z.infer<typeof MediaManifest>;
