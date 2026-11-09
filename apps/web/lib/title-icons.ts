import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Title, TitleIconManifest, type TitleIconMedia } from "schema";
import { REPO_ROOT } from "./data";

/**
 * Which title icons have web copies (ADR-017). They are CIG's art, copied from the Star Citizen
 * Wiki for local development only: the copies and the manifest that lists them are git-ignored,
 * so a fresh clone, CI and every deploy have none and the page shows titles without icons.
 */

export const TITLE_ICON_MANIFEST = join(
  REPO_ROOT,
  "apps",
  "web",
  "public",
  "media",
  "manifest.json",
);

/** The image a title shows: the smallest copy as the fallback, every copy by pixel density. */
export interface TitleIconImage {
  readonly src: string;
  readonly srcSet: string;
  readonly width: number;
  readonly height: number;
  /** The original's size, so the page never draws it more than twice as large. */
  readonly naturalWidth: number;
  readonly naturalHeight: number;
}

export function iconImage(entry: TitleIconMedia): TitleIconImage {
  const largest = entry.renditions[0];
  const smallest = entry.renditions.at(-1);
  if (largest === undefined || smallest === undefined) {
    throw new Error(`no renditions for ${entry.file}`);
  }
  return {
    src: smallest.src,
    srcSet: entry.renditions
      // Exact densities ("1.09x" for a 70 px original beside its 64 px copy), never two "1x".
      .map((r) => `${r.src} ${Number((r.width / smallest.width).toFixed(2))}x`)
      .join(", "),
    width: smallest.width,
    height: smallest.height,
    naturalWidth: entry.width,
    naturalHeight: entry.height,
  };
}

/** The manifest's `titles` list; empty when nothing has been built. */
export function loadTitleIcons(): TitleIconMedia[] {
  if (!existsSync(TITLE_ICON_MANIFEST)) return [];
  return TitleIconManifest.parse(
    JSON.parse(readFileSync(TITLE_ICON_MANIFEST, "utf8")),
  ).titles;
}

let cached: Map<string, TitleIconImage> | undefined;

/** The icon for a title, or null when none was built. */
export function titleIcon(title: Title): TitleIconImage | null {
  cached ??= new Map(loadTitleIcons().map((e) => [e.file, iconImage(e)]));
  return title.icon === null ? null : (cached.get(title.icon.file) ?? null);
}
