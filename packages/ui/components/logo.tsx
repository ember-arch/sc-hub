/**
 * The Coppercork logo (ADR-045, ADR-047): the owner's "Launch Cork", a cork of three copper plates
 * lifting off on its flames, beside the "Coppercork" wordmark, traced from the designer's board
 * into two static SVG files, one per scheme (the plates and flames in the board's coppers, the
 * wordmark in the page's ink). Which one shows follows the page theme through the app's
 * `theme-on-light` and `theme-on-dark` rules, as a maker's mark does, so it never flashes the
 * wrong one; both load lazily, so the hidden one is never fetched. The images are decorative:
 * the link around them carries the site's name as text.
 */

/** The lockup's files and their shape (2690 by 542: the board's hero lockup at twice its size, the second c lowercase, ADR-048). */
export const LOGO_FILES = {
  light: "/brand/coppercork-light.svg",
  dark: "/brand/coppercork-dark.svg",
} as const;
export const LOGO_ASPECT = 2690 / 542;

export function Logo({ height = 32 }: { readonly height?: 24 | 32 | 48 }) {
  const width = Math.round(height * LOGO_ASPECT);
  return (
    <>
      <img
        src={LOGO_FILES.light}
        width={width}
        height={height}
        alt=""
        loading="lazy"
        decoding="async"
        className="theme-on-light shrink-0"
      />
      <img
        src={LOGO_FILES.dark}
        width={width}
        height={height}
        alt=""
        loading="lazy"
        decoding="async"
        className="theme-on-dark shrink-0"
      />
    </>
  );
}
