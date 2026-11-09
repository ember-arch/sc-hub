import { type Picture, showcaseFor } from "./showcase";

/**
 * Which CIG key art each index page opens on (ADR-019): a fixed piece from the showcases on file,
 * so the same page always wears the same art. Null when the media is not built, and the masthead
 * stands on the page colour.
 */
const BANDS = {
  ships: { slug: "perseus", pick: "background" },
  components: { slug: "odin", pick: "gallery:2" },
  titles: { slug: "odin", pick: "poster" },
  funding: { slug: "odin", pick: "background" },
  news: { slug: "perseus", pick: "gallery:0" },
} as const;

export type BandPage = keyof typeof BANDS;

export function bandArt(page: BandPage): Picture | null {
  const band = BANDS[page];
  const show = showcaseFor(band.slug, band.slug);
  if (show === null) return null;
  if (band.pick === "poster") return show.poster ?? show.background;
  if (band.pick === "background") return show.background;
  const index = Number(band.pick.slice("gallery:".length));
  return show.gallery[index] ?? show.background;
}
