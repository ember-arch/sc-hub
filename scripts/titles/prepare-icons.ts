/**
 * Web copies of the title icons (ADR-017), called by `scripts/media/prepare.ts`, which passes in
 * `sharp`. Reads `fixtures/titles-media/` (git-ignored) and writes WebP copies to
 * `apps/web/public/media/titles/` (git-ignored); returns the manifest's `titles` list. Nothing on
 * file, nothing written: the site then shows titles without icons.
 *
 * Icons are resized and re-encoded only, never cropped, recolored or retouched. Each gets a copy
 * at 64 and 128 px (the page draws icons at up to 64 CSS px, so 128 serves 2x screens), never
 * larger than the original.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TitleIconMedia } from "schema";
import { IconSources } from "./icons.js";

/** The slice of sharp's API this uses, so the module does not depend on sharp itself. */
export interface ImagePipeline {
  metadata(): Promise<{
    width?: number | undefined;
    height?: number | undefined;
  }>;
  resize(options: {
    width: number;
    height: number;
    fit: "inside";
    withoutEnlargement: true;
  }): ImagePipeline;
  webp(options: { quality: number }): ImagePipeline;
  toFile(path: string): Promise<{ width: number; height: number }>;
}
export type ImageTool = (input: string) => ImagePipeline;

/** Largest first. */
export const ICON_BOXES = [128, 64] as const;

/** `Title_Civilian.png` → `title-civilian-png`: unique per file, safe in a URL. */
export function iconStem(file: string): string {
  return file
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function prepareTitleIcons(options: {
  readonly image: ImageTool;
  readonly sourcesDir: string;
  readonly mediaDir: string;
}): Promise<TitleIconMedia[]> {
  const sourcesFile = join(options.sourcesDir, "sources.json");
  if (!existsSync(sourcesFile)) return [];
  const rows = IconSources.parse(JSON.parse(readFileSync(sourcesFile, "utf8")));
  const outDir = join(options.mediaDir, "titles");
  mkdirSync(outDir, { recursive: true });
  const out: TitleIconMedia[] = [];
  const stems = new Map<string, string>();
  for (const row of rows) {
    const stem = iconStem(row.file);
    const other = stems.get(stem);
    if (other !== undefined && other !== row.file) {
      throw new Error(
        `title icons ${other} and ${row.file} would share the web name ${stem}`,
      );
    }
    stems.set(stem, row.file);
    const input = join(options.sourcesDir, row.file);
    if (!existsSync(input)) continue;
    const meta = await options.image(input).metadata();
    if (meta.width === undefined || meta.height === undefined) continue;
    const longest = Math.max(meta.width, meta.height);
    const renditions: TitleIconMedia["renditions"] = [];
    for (const box of ICON_BOXES) {
      const target = Math.min(box, longest);
      if (renditions.some((r) => Math.max(r.width, r.height) === target)) {
        continue;
      }
      const src = `/media/titles/${stem}-${target}.webp`;
      const info = await options
        .image(input)
        .resize({
          width: target,
          height: target,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toFile(join(outDir, src.slice("/media/titles/".length)));
      renditions.push({ src, width: info.width, height: info.height });
    }
    out.push({
      file: row.file,
      width: meta.width,
      height: meta.height,
      renditions,
    });
  }
  return out;
}
