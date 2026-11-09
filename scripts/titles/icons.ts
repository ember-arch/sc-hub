/**
 * Which title icons to copy and how to record them (ADR-017). Pure, so the unit tests cover it.
 *
 * The icons are CIG's art. The wiki labels its title icons "Cloud Imperium IP"; they are not the
 * wiki's work and not under its text licence. The owner allowed copying them once from the wiki
 * for local development only (2026-11-08): they live in `fixtures/titles-media/`, git-ignored,
 * and only `sources.json` (where each came from, with its checksum) is committed.
 */

import { createHash } from "node:crypto";
import type { TitleCatalog } from "schema";
import { z } from "zod";
import { TitlesShapeError } from "./html.js";
import { MEDIA_ORIGIN } from "./parse.js";

export const IconSource = z.strictObject({
  /** The wiki's file name, also the local file name in `fixtures/titles-media/`. */
  file: z.string().min(1),
  /** The original upload on media.starcitizen.tools. */
  url: z.url(),
  /** The wiki's description page for the file, where its licence label is shown. */
  file_page: z.url(),
  bytes: z.int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  fetched_at: z.iso.datetime({ offset: true }),
});
export type IconSource = z.infer<typeof IconSource>;

export const IconSources = z.array(IconSource);

/** Characters Windows and POSIX file systems both refuse, or that would leave the folder. */
const UNSAFE_CHARS = /[<>:"/\\|?*]|^\.|\.\.$/;
const unsafe = (name: string): boolean =>
  UNSAFE_CHARS.test(name) || [...name].some((c) => c.charCodeAt(0) < 0x20);

export interface IconToFetch {
  readonly file: string;
  readonly url: string;
}

/**
 * The distinct icons the catalogue names, minus those already copied from the same address.
 * Several titles can share one icon (the recruitment bonus titles do).
 */
export function iconsToFetch(
  catalog: TitleCatalog,
  done: readonly IconSource[],
  exists: (file: string) => boolean,
): IconToFetch[] {
  const byFile = new Map<string, string>();
  for (const title of catalog.titles) {
    const icon = title.icon;
    if (icon === null) continue;
    if (unsafe(icon.file)) {
      throw new TitlesShapeError("icon file name is not safe to write", {
        file: icon.file,
      });
    }
    if (!icon.url.startsWith(MEDIA_ORIGIN)) {
      throw new TitlesShapeError("icon is not on the wiki's media host", {
        url: icon.url,
      });
    }
    const seen = byFile.get(icon.file);
    if (seen !== undefined && seen !== icon.url) {
      throw new TitlesShapeError("one file name, two addresses", {
        file: icon.file,
      });
    }
    byFile.set(icon.file, icon.url);
  }
  return [...byFile]
    .filter(([file, url]) => {
      const prior = done.find((d) => d.file === file);
      return prior === undefined || prior.url !== url || !exists(file);
    })
    .map(([file, url]) => ({ file, url }));
}

/** The image types the wiki serves for titles, by their first bytes. */
export function imageKind(bytes: Uint8Array): "png" | "jpeg" | "svg" | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i.test(head))
    return "svg";
  return null;
}

const EXTENSIONS: Readonly<Record<"png" | "jpeg" | "svg", RegExp>> = {
  png: /\.png$/i,
  jpeg: /\.jpe?g$/i,
  svg: /\.svg$/i,
};

/** Checks the bytes are the image the file name says, and records where they came from. */
export function recordIcon(
  icon: IconToFetch,
  bytes: Uint8Array,
  fetchedAt: string,
): IconSource {
  const kind = imageKind(bytes);
  if (kind === null || !EXTENSIONS[kind].test(icon.file)) {
    throw new TitlesShapeError("download is not the image its name says", {
      file: icon.file,
      kind,
    });
  }
  return {
    file: icon.file,
    url: icon.url,
    file_page: `https://starcitizen.tools/File:${encodeURIComponent(icon.file)}`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fetched_at: fetchedAt,
  };
}
