/**
 * The Coppercork mark (ADR-041): a cork stopper in copper with its label as an ink band, drawn
 * from the site's one brand colour, `--brand-copper`, which the app's stylesheet sets per scheme
 * (the light value stands in where the variable is missing, as in a story rendered alone). The
 * band takes the text colour around it, so the mark sits in the header's ink in either scheme.
 * Decorative beside the name: the wordmark is the accessible text, the mark is hidden from it.
 */
export const MARK_COPPER = { light: "#A8652F", dark: "#D08A4F" } as const;

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
      <path
        d="M9 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3.5l1.5 17A2 2 0 0 1 22.5 29h-13a2 2 0 0 1-2-2.5L9 9.5Z"
        fill={`var(--brand-copper, ${MARK_COPPER.light})`}
      />
      <rect x="8.6" y="12" width="14.8" height="2.4" fill="currentColor" />
    </svg>
  );
}
