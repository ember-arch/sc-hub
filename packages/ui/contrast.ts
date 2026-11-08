/**
 * WCAG 2 contrast for the token colors (system.md section 6: at least 4.5:1 for text in both
 * modes). Pure; the tokens test runs it over every text color on every background so a token
 * change that breaks the rule fails the build instead of a Lighthouse run that happens to use
 * the other scheme.
 */

/** `#RRGGBB` to linear-light relative luminance (WCAG 2.x). */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`not a #RRGGBB color: ${hex}`);
  const channel = (pair: string | undefined): number => {
    const c = parseInt(pair ?? "0", 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(m[1]) + 0.7152 * channel(m[2]) + 0.0722 * channel(m[3])
  );
}

/** The WCAG contrast ratio of two `#RRGGBB` colors, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
