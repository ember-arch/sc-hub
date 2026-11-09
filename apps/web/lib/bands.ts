import { type Picture, type ShowcaseView, showcaseFor } from "./showcase";

/**
 * Which CIG key art each index page opens on (ADR-019): a fixed piece from the showcases on file,
 * named by its image key so a rebuilt gallery order never changes a page's art. Null when the
 * media is not built, and the masthead stands on the page colour.
 */
const BANDS = {
  ships: { slug: "perseus", pick: "background" },
  components: { slug: "odin", pick: "gallery:sc-anvil-odin-exterior-3" },
  titles: { slug: "odin", pick: "poster" },
  funding: { slug: "odin", pick: "background" },
  news: { slug: "perseus", pick: "gallery:render-3" },
} as const;

export type BandPage = keyof typeof BANDS;

export type ShowcaseLookup = (
  slug: string,
  name: string,
) => ShowcaseView | null;

export function bandArt(
  page: BandPage,
  lookup: ShowcaseLookup = showcaseFor,
): Picture | null {
  const band = BANDS[page];
  const show = lookup(band.slug, band.slug);
  if (show === null) return null;
  if (band.pick === "poster") return show.poster ?? show.background;
  if (band.pick === "background") return show.background;
  const key = band.pick.slice("gallery:".length);
  return (
    show.gallery.find(
      (p) => p.src.includes(`/${key}-`) || p.src.includes(`/${key}.`),
    ) ?? show.background
  );
}
