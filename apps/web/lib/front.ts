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
  { number: "04", label: "Dispatches", href: "/news" },
  { number: "05", label: "About this almanac", href: "/about" },
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

/** The window the featured developer posts are drawn from (ADR-038, ADR-039). */
export const FEATURED_WINDOW_HOURS = 48;
/** How far back the window reaches when the first one holds fewer than five threads (ADR-039). */
export const FEATURED_REACH_HOURS = 72;

/** A post as the featured-post rule needs it: when it was published, which thread, and its address. */
export interface FeaturedCandidate {
  readonly published_at: string;
  readonly thread_id: string | null;
  /** The post's address; a reply's ends in its number, the thread's own page does not. */
  readonly url: string;
  /** Likes on the post as the pack records them; null or absent until the worker records them. */
  readonly likes?: number | null | undefined;
}

/** The thread a post belongs to: its id on the pack, or its thread's address without the post number. */
const threadKey = (p: FeaturedCandidate): string =>
  p.thread_id ?? p.url.replace(/\/\d+$/, "");

/** The thread's opening post: its address is the thread's own page, with no post number on it. */
const opensThread = (p: FeaturedCandidate): boolean => !/\/\d+$/.test(p.url);

/**
 * The front page's featured developer posts (ADR-038, ADR-039), one card per thread (the thread's
 * newest post), five at most, in tiers:
 *
 *   1. threads CIG staff opened (the thread's opening post is on the pack) with a staff post in
 *      the last `hours`, newest first; when fewer than `max`, the same reaching back `reach` hours;
 *   2. then threads staff only answered in, within `reach` hours, by likes where the pack records
 *      them and newest first otherwise;
 *   3. when fewer than `min` in all, the newest remaining threads fill the list to `min`.
 *
 * The pack carries no likes yet (ADR-037 strips Spectrum's votes), so the second tier is by
 * recency until the worker records them; the field is read here so that nothing else changes
 * then. `posts` is expected newest first, as the repository keeps it.
 */
export function featuredPosts<T extends FeaturedCandidate>(
  posts: readonly T[],
  now: Date,
  {
    hours = FEATURED_WINDOW_HOURS,
    reach = FEATURED_REACH_HOURS,
    min = 3,
    max = 5,
  } = {},
): T[] {
  const sorted = [...posts].sort((a, b) =>
    b.published_at.localeCompare(a.published_at),
  );
  const staffOpened = new Set(sorted.filter(opensThread).map(threadKey));
  const seen = new Set<string>();
  const firstPerThread = sorted.filter((p) => {
    const key = threadKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const within =
    (h: number) =>
    (p: T): boolean =>
      Date.parse(p.published_at) >= now.getTime() - h * 3_600_000;
  const opened = firstPerThread.filter((p) => staffOpened.has(threadKey(p)));
  const answered = firstPerThread.filter((p) => !staffOpened.has(threadKey(p)));
  const byLikes = (list: readonly T[]): T[] =>
    [...list].sort(
      (a, b) =>
        (b.likes ?? -1) - (a.likes ?? -1) ||
        b.published_at.localeCompare(a.published_at),
    );
  const picked: T[] = [];
  const take = (list: readonly T[], upTo: number): void => {
    for (const p of list) {
      if (picked.length >= upTo) return;
      if (!picked.includes(p)) picked.push(p);
    }
  };
  take(opened.filter(within(hours)), max);
  take(opened.filter(within(reach)), max);
  take(byLikes(answered.filter(within(reach))), max);
  take(firstPerThread, Math.min(min, max));
  return picked;
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

/**
 * The freshest word from CIG on Spectrum for the daily line (ADR-042): the newest post of the last
 * `hours` in a thread staff opened (its opening post on the pack), as the featured-post rule reads
 * it (ADR-039); null when none.
 */
export function freshestStaffWord<T extends FeaturedCandidate>(
  posts: readonly T[],
  now: Date,
  hours = FEATURED_WINDOW_HOURS,
): T | null {
  const since = now.getTime() - hours * 3_600_000;
  const sorted = [...posts].sort((a, b) =>
    b.published_at.localeCompare(a.published_at),
  );
  const staffOpened = new Set(sorted.filter(opensThread).map(threadKey));
  return (
    sorted.find(
      (p) =>
        Date.parse(p.published_at) >= since && staffOpened.has(threadKey(p)),
    ) ?? null
  );
}

/** What the pack says today, as the daily line reads it (ADR-042). Nulls are left out. */
export interface DailyFacts {
  /** The newest staff-opened Spectrum thread with a staff post in the window, or null. */
  readonly staffThread: {
    readonly title: string;
    readonly publishedAt: string;
  } | null;
  /** The newest dispatch, or null. */
  readonly dispatch: {
    readonly title: string;
    readonly publishedAt: string;
  } | null;
  /** The builds in the footer's patch strip, short ("4.10.2"), or null where unknown. */
  readonly builds: {
    readonly live: string | null;
    readonly ptu: string | null;
  };
  /** This year's pledges so far and the change on the same days of last year. */
  readonly funding: {
    readonly year: number;
    readonly yearToDate: string;
    readonly change: string | null;
  } | null;
}

/**
 * A Spectrum thread's title as a headline reads it: CIG's audience tag in brackets at the front
 * ("[All Waves] ") and a build number at the end (" 13160301") are dropped, nothing else changes.
 */
export function headlineTitle(title: string): string {
  return title
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s+\d{6,}\s*$/, "")
    .trim();
}

/** "4.10.2-LIVE.12881860" → "4.10.2": the build as the strip prints it, before its channel. */
export const shortBuild = (version: string | null): string | null =>
  version === null ? null : (version.split("-")[0] ?? version);

/**
 * The daily line (ADR-042): two clauses from the pack, composed by rule and never written. The
 * first is the freshest word from CIG, a staff-opened thread or a dispatch, whichever is newer;
 * the second alternates by the UTC day between the builds and the funding, so the line changes
 * shape day to day as well as with the pack. With nothing on the pack the line is the tagline's
 * first words.
 */
export function dailyLine(
  facts: DailyFacts,
  now: Date,
  dayNumber: number,
): string {
  const hours = (at: string): number =>
    Math.max(0, (now.getTime() - Date.parse(at)) / 3_600_000);
  const ago = (at: string): string => {
    const h = Math.round(hours(at));
    if (h < 1) return "just now";
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} ${d === 1 ? "day" : "days"} ago`;
  };
  const word =
    facts.staffThread !== null &&
    (facts.dispatch === null ||
      facts.staffThread.publishedAt >= facts.dispatch.publishedAt)
      ? `CIG posted “${headlineTitle(facts.staffThread.title)}” on Spectrum ${ago(facts.staffThread.publishedAt)}`
      : facts.dispatch !== null
        ? `the latest dispatch is “${facts.dispatch.title}”, ${ago(facts.dispatch.publishedAt)}`
        : null;
  const builds =
    facts.builds.live === null
      ? null
      : facts.builds.ptu === null
        ? `Alpha ${facts.builds.live} is live`
        : `Alpha ${facts.builds.live} is live and ${facts.builds.ptu} is on the PTU`;
  const funding =
    facts.funding === null
      ? null
      : `${facts.funding.yearToDate} pledged in ${facts.funding.year}${facts.funding.change === null ? "" : `, ${facts.funding.change} on ${facts.funding.year - 1}`}`;
  const state = dayNumber % 2 === 0 ? (funding ?? builds) : (builds ?? funding);
  const clauses = [word, state].filter((c): c is string => c !== null);
  if (clauses.length === 0) return "Star Citizen, on record.";
  const sentence = clauses.join(", and ");
  return `${sentence[0]?.toUpperCase() ?? ""}${sentence.slice(1)}.`;
}
