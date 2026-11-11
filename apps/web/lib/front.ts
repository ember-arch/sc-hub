/**
 * The front page's pure parts (ADR-020, ADR-038, spec 06): the contents list, the date line,
 * plate numerals, which ships take the plates and change daily, and which developer posts are
 * featured. No data access here; page.tsx hands in what it read so these can be tested on plain
 * values.
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

/** The window the featured developer posts are drawn from (ADR-038). */
export const FEATURED_WINDOW_HOURS = 48;

/** A post as the featured-post rule needs it: when it was published and which thread it is in. */
export interface FeaturedCandidate {
  readonly published_at: string;
  readonly thread_id: string | null;
  /** The post's address; a reply's ends in its number, which keys the thread when the id is missing. */
  readonly url: string;
}

/** The thread a post belongs to: its id on the pack, or its thread's address without the post number. */
const threadKey = (p: FeaturedCandidate): string =>
  p.thread_id ?? p.url.replace(/\/\d+$/, "");

/**
 * The front page's featured developer posts (ADR-038): the posts of the last `hours` before `now`,
 * one per thread (the thread's newest post), newest thread first, `max` at most; when fewer than
 * `min` threads posted in the window, the newest posts outside it fill the list to `min`, still one
 * per thread. "Top" is recency by thread: the pack carries no votes or reply counts, and one busy
 * thread must not fill the section. `posts` is expected newest first, as the repository keeps it.
 */
export function featuredPosts<T extends FeaturedCandidate>(
  posts: readonly T[],
  now: Date,
  { hours = FEATURED_WINDOW_HOURS, min = 3, max = 5 } = {},
): T[] {
  const since = now.getTime() - hours * 3_600_000;
  const sorted = [...posts].sort((a, b) =>
    b.published_at.localeCompare(a.published_at),
  );
  const seen = new Set<string>();
  const firstPerThread = sorted.filter((p) => {
    const key = threadKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const recent = firstPerThread.filter(
    (p) => Date.parse(p.published_at) >= since,
  );
  if (recent.length >= min) return recent.slice(0, max);
  return firstPerThread.slice(0, Math.min(min, max));
}

/** mulberry32: a small seeded generator, enough to shuffle a list the same way for one seed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The bento's changing cards (ADR-038): `count` ships drawn from those with a picture (from all of
 * them when none has one, so a build without media keeps the layout), by a shuffle seeded with the
 * UTC day number, so every build on one day draws the same ships and the next day draws others.
 * The showcase pair are not candidates; `pickPlates` places them.
 */
export function dailyPicks<T extends PlateCandidate>(
  candidates: readonly T[],
  dayNumber: number,
  count: number,
): T[] {
  const pictured = candidates.filter((c) => c.hasPicture);
  const pool = [...(pictured.length > 0 ? pictured : candidates)];
  const next = seeded(dayNumber);
  // A partial Fisher-Yates: only the first `count` positions need settling.
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(next() * (pool.length - i));
    const a = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = a;
  }
  return pool.slice(0, n);
}

/** The UTC day number of a date: the seed of the day's draw, the same for every build on that day. */
export function utcDayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}
