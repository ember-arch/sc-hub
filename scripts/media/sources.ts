/**
 * Where ship pages and manufacturer pages get their images (ADR-009), and the matching rules.
 * Pure functions and constants only, so the unit tests run them with no network and no files.
 */

import { z } from "zod";

export const RSI_ORIGIN = "https://robertsspaceindustries.com";
export const SHIP_MATRIX_URL = `${RSI_ORIGIN}/ship-matrix/index`;

/** CLAUDE.md section 9: one request every 5 seconds to robertsspaceindustries.com. */
export const RSI_SPACING_MS = 5_000;

/** The size RSI's ship matrix lists for every ship; it names the image, whose original is wider. */
export const RSI_IMAGE_SIZE = "wallpaper_1920x1080";

/**
 * The same image at the size it was uploaded (ADR-015): RSI's media host serves every image's
 * original under `source`. A 1920 copy is soft across a 4K or 5K screen; the original is not.
 */
export function originalOf(imageUrl: string): string {
  return imageUrl.replace(/\/[a-z0-9_]+(\.[a-z]+)$/i, "/source$1");
}

/**
 * Web copies of each ship image, widest first. 3840 and 2560 serve the full-bleed opening band on
 * high-density and 4K screens (ADR-015); 960 serves phones at 2x and small laptops without the
 * 1280 copy; 480 serves cards on phones (Lighthouse, 2026-11-08).
 */
export const SHIP_WIDTHS: readonly number[] = [
  3840, 2560, 1920, 1280, 960, 640, 480,
];

/** Logo height in pixels: twice the largest size the site draws one. */
export const LOGO_HEIGHT = 128;

/**
 * Fankit logo files per manufacturer code, matched by the maker's name in the file name. `onLight`
 * is the dark mark for light backgrounds, `onDark` the light mark. Mirai has no light wordmark in
 * the fankit, so dark backgrounds get its icon mark, which is drawn for dark grounds; the
 * guidelines forbid recoloring a mark to make one.
 */
export const FANKIT_LOGOS: Readonly<
  Record<string, { readonly onLight: string; readonly onDark: string | null }>
> = {
  AEGS: {
    onLight: "AEGIS_DYNAMICS_BLACK.png",
    onDark: "AEGIS_DYNAMICS_WHITE.png",
  },
  ANVL: {
    onLight: "ANVIL_AEROSPACE_BLACK.png",
    onDark: "ANVIL_AEROSPACE_WHITE.png",
  },
  DRAK: {
    onLight: "DRAKE_INTERPLANETARY_BLACK.png",
    onDark: "DRAKE_INTERPLANETARY_WHITE.png",
  },
  MISC: {
    onLight: "MISC_Logo_SecondaryMark_Black.png",
    onDark: "MISC_Logo_SecondaryMark_white.png",
  },
  MRAI: {
    onLight: "MISC_Mirai_Logo_PrimaryMark_Black_4k.png",
    onDark: "MISC_Mirai_Logo_IconMark_4k.png",
  },
  RSI: { onLight: "RSI_BLACK.png", onDark: "RSI_WHITE.png" },
};

export interface PackVehicle {
  readonly class_name: string;
  readonly name: string;
  readonly manufacturer_code: string;
}

/** The fields of one ship-matrix row this project reads. */
export interface MatrixShip {
  readonly name: string;
  readonly url: string;
  readonly manufacturer: { readonly code: string };
  readonly media: readonly {
    readonly images: Readonly<Record<string, string>>;
  }[];
}

export interface ShipMatch {
  readonly vehicle: PackVehicle;
  readonly pageUrl: string;
  readonly imageUrl: string;
}

export interface MatchResult {
  readonly matched: readonly ShipMatch[];
  /** Pack vehicles with no single exact match, or no image: they get no image. */
  readonly unmatched: readonly { vehicle: PackVehicle; reason: string }[];
}

/**
 * A pack vehicle matches a ship-matrix row only when the name and the manufacturer code are both
 * identical and exactly one row has them. Anything looser is a guess (CLAUDE.md section 2: entity
 * links below the confidence threshold stay hidden), so it is reported, not matched.
 */
export function matchShips(
  pack: readonly PackVehicle[],
  matrix: readonly MatrixShip[],
): MatchResult {
  const matched: ShipMatch[] = [];
  const unmatched: { vehicle: PackVehicle; reason: string }[] = [];
  for (const vehicle of pack) {
    const rows = matrix.filter(
      (row) =>
        row.name === vehicle.name &&
        row.manufacturer.code === vehicle.manufacturer_code,
    );
    if (rows.length !== 1) {
      unmatched.push({
        vehicle,
        reason:
          rows.length === 0
            ? "no ship-matrix row with this name and maker"
            : `${rows.length} ship-matrix rows share this name and maker`,
      });
      continue;
    }
    const row = rows[0]!;
    const imageUrl = row.media[0]?.images[RSI_IMAGE_SIZE];
    if (imageUrl === undefined || !imageUrl.startsWith("https://")) {
      unmatched.push({ vehicle, reason: `no ${RSI_IMAGE_SIZE} image` });
      continue;
    }
    matched.push({
      vehicle,
      pageUrl: new URL(row.url, RSI_ORIGIN).toString(),
      imageUrl,
    });
  }
  return { matched, unmatched };
}

/** `/media/ships/aegs_gladius-1280.webp`: lower case, safe for any static host. */
export function shipRenditionPath(className: string, width: number): string {
  return `/media/ships/${className.toLowerCase()}-${width}.webp`;
}

/** `/media/concepts/odin-1280.webp`: a concept ship's image by slug (ADR-022). */
export function conceptRenditionPath(slug: string, width: number): string {
  return `/media/concepts/${slug}-${width}.webp`;
}

export function logoRenditionPath(
  code: string,
  ground: "light" | "dark",
): string {
  return `/media/makers/${code.toLowerCase()}-on-${ground}.webp`;
}

/**
 * Waits so consecutive requests start at least `spacingMs` apart. `sleep` and `now` are injected
 * so the tests run on fake time.
 */
export function createSpacer(
  spacingMs: number,
  sleep: (ms: number) => Promise<void>,
  now: () => number,
): () => Promise<void> {
  let last = Number.NEGATIVE_INFINITY;
  return async () => {
    const wait = last + spacingMs - now();
    if (wait > 0) await sleep(wait);
    last = now();
  };
}

/** One row of `fixtures/rsi-media/sources.json`: where a copied ship image came from. */
export const RsiSource = z.strictObject({
  class_name: z.string(),
  file: z.string(),
  page_url: z.url(),
  image_url: z.url(),
  content_type: z.string(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  fetched_at: z.iso.datetime({ offset: true }),
});
export type RsiSource = z.infer<typeof RsiSource>;

/** One row of `fixtures/rsi-media/concept-sources.json`: a concept ship's copied image, by slug (ADR-022). */
export const ConceptSource = RsiSource.omit({ class_name: true }).extend({
  slug: z.string().min(1),
});
export type ConceptSource = z.infer<typeof ConceptSource>;
