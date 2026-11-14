import { withoutEmoji } from "ui";

/**
 * The front page's pure parts (ADR-020, ADR-038, ADR-058, spec 06): the date line, the lead story,
 * plate numerals, which ships take the plates and change daily, and which developer posts are
 * featured. No data access here; page.tsx hands in what it read so these can be tested on plain
 * values.
 */

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
 *   2. then threads staff only answered in, within `reach` hours, newest first (not by likes:
 *      the owner's call of 2026-11-11, ADR-039);
 *   3. when fewer than `min` in all, the newest remaining threads fill the list to `min`.
 *
 * `posts` is expected newest first, as the repository keeps it.
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
  const picked: T[] = [];
  const take = (list: readonly T[], upTo: number): void => {
    for (const p of list) {
      if (picked.length >= upTo) return;
      if (!picked.includes(p)) picked.push(p);
    }
  };
  take(opened.filter(within(hours)), max);
  take(opened.filter(within(reach)), max);
  take(answered.filter(within(reach)), max);
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
  return shuffled(
    pictured.length > 0 ? pictured : candidates,
    dayNumber,
    count,
  );
}

/**
 * The first `count` of a list (all of it by default) in an order seeded by `seed`: the same seed
 * gives the same order on every build. A partial Fisher-Yates: only the first `count` positions
 * need settling.
 */
export function shuffled<T>(
  list: readonly T[],
  seed: number,
  count: number = list.length,
): T[] {
  const pool = [...list];
  const next = seeded(seed);
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
 * The UTC week number of a UTC day number, weeks starting on Monday (day 0, 1 January 1970, was a
 * Thursday): the seed of the featured ships' weekly draw (ADR-060).
 */
export function utcWeekNumber(dayNumber: number): number {
  return Math.floor((dayNumber + 3) / 7);
}

/** A candidate for the front page's lead story (ADR-058): a dispatch or a full video. */
export interface LeadCandidate {
  readonly source: "comm_link" | "video";
  readonly title: string;
  readonly published_at: string;
  /** Whether the site holds a picture for it: a Comm-Link's cover, a video's thumbnail. */
  readonly hasPicture: boolean;
}

/** A title as a story's key: CIG's "Star Citizen | " prefix and its punctuation dropped. */
export function storyKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*(?:star citizen|squadron 42)\s*[|:–-]\s*/, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** How many days a video and a Comm-Link of one title may lie apart and still be one story. */
export const LEAD_PAIR_DAYS = 3;

/**
 * A store promotion by its title: the monthly bundle, a sale, the subscribers' promotions, Twitch
 * drops. CIG's own words for them; they stay in the dispatches but do not lead (ADR-058).
 */
export const PROMOTION =
  /\b(?:store|bundles?|sales?|promotions?|subscribers?|twitch drops|giveaways?|referral)\b/i;

const dayOf = (c: Pick<LeadCandidate, "published_at">): number =>
  utcDayNumber(new Date(c.published_at));

/** A Comm-Link before a video, then the newest, then the title, so every build agrees. */
const leadOrder = (a: LeadCandidate, b: LeadCandidate): number =>
  (a.source === "comm_link" ? 0 : 1) - (b.source === "comm_link" ? 0 : 1) ||
  b.published_at.localeCompare(a.published_at) ||
  a.title.localeCompare(b.title);

/**
 * The front page's lead story outside a show (ADR-058): from the Comm-Links and full videos
 * published before today's UTC day began (so the lead changes at most once a day and holds through
 * quiet days), store promotions aside while anything else is there. The latest such day leads;
 * a story with a picture is preferred within three days of it (a missing cover never lets an old
 * video lead for long), on the latest of those days a Comm-Link before a video, the newest first.
 * With no picture within those days, the latest day's story leads in words alone. A video whose
 * title is the lead Comm-Link's, published within three days of it and before today, rides along.
 */
export function leadStory<T extends LeadCandidate>(
  candidates: readonly T[],
  now: Date,
): { readonly lead: T; readonly video: T | null } | null {
  const today = utcDayNumber(now);
  const before = candidates.filter((c) => dayOf(c) < today);
  const stories = before.filter((c) => !PROMOTION.test(c.title));
  const eligible = stories.length > 0 ? stories : before;
  if (eligible.length === 0) return null;
  const latestDay = Math.max(...eligible.map(dayOf));
  const recent = eligible.filter((c) => dayOf(c) > latestDay - LEAD_PAIR_DAYS);
  const pictured = recent.filter((c) => c.hasPicture);
  const pool =
    pictured.length > 0
      ? pictured
      : recent.filter((c) => dayOf(c) === latestDay);
  const bestDay = Math.max(...pool.map(dayOf));
  const lead = pool.filter((c) => dayOf(c) === bestDay).sort(leadOrder)[0]!;
  if (lead.source === "video") return { lead, video: null };
  const key = storyKey(lead.title);
  const at = Date.parse(lead.published_at);
  const video =
    before
      .filter(
        (c) =>
          c.source === "video" &&
          storyKey(c.title) === key &&
          Math.abs(Date.parse(c.published_at) - at) <=
            LEAD_PAIR_DAYS * 86_400_000,
      )
      .sort((a, b) => b.published_at.localeCompare(a.published_at))[0] ?? null;
  return { lead, video };
}

/** What `pickLead` reads of a dispatch or a video. */
export interface LeadItem {
  readonly id: string;
  readonly source: string;
  readonly external_id: string;
  readonly title: string;
  readonly published_at: string;
  readonly url: string;
}

/**
 * The lead story from the pack as the front page holds it: the Comm-Links among the dispatches
 * (with a picture when the media has their cover) and the full videos, no Shorts (every upload has
 * YouTube's thumbnails, ADR-050).
 */
export function pickLead<T extends LeadItem>(
  dispatches: readonly T[],
  videos: readonly T[],
  hasCover: (externalId: string) => boolean,
  isShort: (item: T) => boolean,
  now: Date,
): { readonly lead: T; readonly video: T | null } | null {
  const picked = leadStory(
    [
      ...dispatches
        .filter((d) => d.source === "comm_link")
        .map((item) => ({
          item,
          source: "comm_link" as const,
          title: item.title,
          published_at: item.published_at,
          hasPicture: hasCover(item.external_id),
        })),
      ...videos
        .filter((v) => !isShort(v))
        .map((item) => ({
          item,
          source: "video" as const,
          title: item.title,
          published_at: item.published_at,
          hasPicture: true,
        })),
    ],
    now,
  );
  return picked === null
    ? null
    : { lead: picked.lead.item, video: picked.video?.item ?? null };
}

/**
 * The lead's excerpt: CIG's summary without emoji (CLAUDE.md section 2), none when it is a bare
 * link or carries one (a video's "Wishlist on Steam Now: https://…" is not a lead's words).
 */
export function leadExcerpt(summary: string | null): string | null {
  if (summary === null) return null;
  const text = withoutEmoji(summary).trim();
  if (text === "" || /https?:\/\//i.test(text)) return null;
  return text;
}
