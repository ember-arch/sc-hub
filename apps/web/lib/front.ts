/**
 * The front page's pure parts (ADR-020, spec 06 "Front page and register"): the contents list,
 * the date line, plate numerals and which ships take the plates. No data access here; page.tsx
 * hands in what it read so these can be tested on plain values.
 */

export interface ContentsEntry {
  /** The section's number as printed, "01"… */
  readonly number: string;
  readonly label: string;
  readonly href: string;
}

/** The almanac's sections, in reading order. */
export const CONTENTS: readonly ContentsEntry[] = [
  { number: "01", label: "The register of ships", href: "/ships" },
  { number: "02", label: "Parts, by type", href: "/components" },
  { number: "03", label: "Honours and titles", href: "/titles" },
  { number: "04", label: "The ledger of pledges", href: "/funding" },
  { number: "05", label: "Dispatches", href: "/news" },
  { number: "06", label: "About this almanac", href: "/about" },
];

const dateLine = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Sunday 9 November 2026", in UTC so the server and a reader anywhere print the same day. */
export function formatFrontDate(date: Date): string {
  return dateLine.format(date).replace(",", "");
}

const ROMAN: readonly (readonly [number, string])[] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 1 → "I", 4 → "IV", 12 → "XII"; plates are numbered the almanac way. Up to 39. */
export function romanNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 39)
    throw new RangeError(`no numeral for ${n}`);
  let rest = n;
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

export interface PlateCandidate {
  readonly slug: string;
  /** Length in metres, for choosing the third plate; null when unknown. */
  readonly length: number | null;
  readonly hasPicture: boolean;
}

/**
 * The cards of the front page's bento: the live example first and largest, the concept hero beside
 * it, then the `others` longest ships that have a picture (the longest of all when none has one),
 * longest first. A missing showcase ship leaves its card out rather than promoting another: the
 * pair is the owner's choice (ADR-010), not a ranking.
 */
export function pickPlates<T extends PlateCandidate>(
  candidates: readonly T[],
  liveExample: string,
  conceptHero: string,
  others = 1,
): readonly T[] {
  const live = candidates.find((c) => c.slug === liveExample);
  const concept = candidates.find((c) => c.slug === conceptHero);
  const rest = candidates.filter(
    (c) => c.slug !== liveExample && c.slug !== conceptHero,
  );
  const byLength = (list: readonly T[]): T[] =>
    [...list].sort((a, b) => (b.length ?? -1) - (a.length ?? -1));
  const pictured = byLength(rest.filter((c) => c.hasPicture));
  const more = (pictured.length > 0 ? pictured : byLength(rest)).slice(
    0,
    others,
  );
  return [live, concept, ...more].filter((c): c is T => c !== undefined);
}

/** "+21.2K", "−3", "0": a signed figure for a counter's note. */
export function signed(value: number, format: (abs: number) => string): string {
  if (value === 0) return format(0);
  return `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;
}
