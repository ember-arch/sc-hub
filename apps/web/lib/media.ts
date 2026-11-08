import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type HoloFigure,
  type HoloModel,
  MediaManifest,
  type Showcase,
} from "schema";
import type { MakerMark, ResponsiveImage } from "ui";
import { RSI_IMAGE_CREDIT } from "ui/legal";
import { REPO_ROOT, type ShipView } from "./data";

/**
 * Which images exist for which entities (ADR-009), from the manifest `scripts/media/prepare.ts`
 * writes beside the web copies in `public/media/`. Both are git-ignored, so a fresh clone, CI and
 * a deploy have none: every lookup then returns null and pages render without images.
 */

export const MEDIA_MANIFEST = join(
  REPO_ROOT,
  "apps",
  "web",
  "public",
  "media",
  "manifest.json",
);

export interface Media {
  /** The ship's official image, described for the page that is about it. */
  ship(className: string, name: string): ResponsiveImage | null;
  /** The same image for a card, whose alt is empty: the card already names the ship. */
  shipCard(className: string): ResponsiveImage | null;
  maker(code: string, name: string): MakerMark | null;
  /** A showcase ship's media and chapters (ADR-010). */
  showcase(slug: string): Showcase | null;
  /** The ship's RSI holoviewer model (ADR-015). */
  holo(slug: string): HoloModel | null;
  /** The human figure the holoviewer stands beside the ship. */
  holoFigure(): HoloFigure | null;
}

export function createMedia(manifest: MediaManifest | null): Media {
  const ships = new Map(manifest?.ships.map((s) => [s.class_name, s]) ?? []);
  const showcases = new Map(manifest?.showcase.map((s) => [s.slug, s]) ?? []);
  const holos = new Map(manifest?.holo.map((h) => [h.slug, h]) ?? []);
  const makers = new Map(
    manifest?.makers.map((m) => [m.manufacturer_code, m]) ?? [],
  );
  const image = (className: string, alt: string): ResponsiveImage | null => {
    const entry = ships.get(className);
    const widest = entry?.renditions[0];
    if (entry === undefined || widest === undefined) return null;
    // The 1280 copy is the fallback for browsers that ignore srcset; srcset picks the rest.
    const fallback = entry.renditions.find((r) => r.width === 1280) ?? widest;
    return {
      src: fallback.src,
      width: widest.width,
      height: widest.height,
      srcSet: entry.renditions.map((r) => `${r.src} ${r.width}w`).join(", "),
      alt,
      credit: { text: RSI_IMAGE_CREDIT.text, href: entry.page_url },
    };
  };
  return {
    showcase: (slug) => showcases.get(slug) ?? null,
    holo: (slug) => holos.get(slug) ?? null,
    holoFigure: () => manifest?.holo_figure ?? null,
    ship: (className, name) => image(className, `The ${name}`),
    shipCard: (className) => image(className, ""),
    maker(code, name) {
      const entry = makers.get(code);
      if (entry === undefined) return null;
      return {
        alt: `${name} logo`,
        onLight: entry.on_light,
        onDark: entry.on_dark,
      };
    },
  };
}

/** Validates a manifest's text. */
export function parseMediaManifest(text: string): MediaManifest {
  return MediaManifest.parse(JSON.parse(text));
}

/**
 * Reads the manifest; null when it has not been built. The path is a module constant, never a
 * parameter, so the build traces this one file rather than the whole project.
 */
export function loadMediaManifest(): MediaManifest | null {
  if (!existsSync(MEDIA_MANIFEST)) return null;
  return parseMediaManifest(readFileSync(MEDIA_MANIFEST, "utf8"));
}

let cached: Media | undefined;

/** The media lookups, built once per server process. */
export function media(): Media {
  cached ??= createMedia(loadMediaManifest());
  return cached;
}

/** A ship card's image, for pages that list ships. */
export function shipCardImage(ship: ShipView): ResponsiveImage | null {
  return media().shipCard(ship.vehicle.class_name);
}
