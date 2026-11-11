/**
 * The web copies of one Comm-Link cover (ADR-029), shared by `prepare.ts` on the owner's machine
 * and `publish-covers.ts` in CI (ADR-048), so both build the same bytes and therefore the same
 * content-addressed keys (ADR-034). WebP at each of `COVER_WIDTHS` the picture is wide enough
 * for, never upscaled; resized and re-encoded only.
 */
import sharp from "sharp";
import { COVER_WIDTHS } from "./sources.js";

export interface EncodedRendition {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

/** Widest first; empty when the picture is narrower than every width or has no size. */
export async function encodeCoverRenditions(
  input: Buffer,
): Promise<EncodedRendition[]> {
  const meta = await sharp(input).metadata();
  if (meta.width === undefined || meta.height === undefined) return [];
  const out: EncodedRendition[] = [];
  for (const width of COVER_WIDTHS) {
    if (width > meta.width) continue;
    const { data, info } = await sharp(input)
      .resize({ width })
      .webp({ quality: width >= 1280 ? 78 : 74 })
      .toBuffer({ resolveWithObject: true });
    out.push({ width: info.width, height: info.height, data });
  }
  return out;
}
