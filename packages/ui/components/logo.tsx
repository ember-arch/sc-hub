/** The stopper's outline, shared with the favicon (apps/web/app/icon.svg), which a test keeps equal. */
export const MARK_PATH =
  "M9 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3.5l1.5 17A2 2 0 0 1 22.5 29h-13a2 2 0 0 1-2-2.5L9 9.5Z";

/**
 * The Coppercork mark (ADR-041): a cork stopper in the site's own colour, `brand.copper` (the
 * token, per scheme), with its label as an ink band that takes the text colour around it, so the
 * mark sits in the header's ink in either scheme. Decorative beside the name: the wordmark is
 * the accessible text, the mark is hidden from it.
 */
export function Logo({ size = 28 }: { readonly size?: number | undefined }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d={MARK_PATH} fill="var(--brand-copper)" />
      <rect x="8.6" y="12" width="14.8" height="2.4" fill="currentColor" />
    </svg>
  );
}
