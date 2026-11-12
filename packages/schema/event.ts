import { z } from "zod";
import { Slug, Timestamp } from "./common.js";

/**
 * Events (ADR-057): the shows CIG runs every year (the Intergalactic Aerospace Expo, Invictus
 * Launch Week, CitizenCon and the like), each read from RSI's own pages by
 * `scripts/events/fetch.ts` and kept as one file in `fixtures/events/`. Nothing here is typed
 * in: the registry names the pages, and every date, maker, ship and wave comes from them.
 */

/** The kinds of show the module knows; `other` for one without its own short name. */
export const EventKind = z.enum(["iae", "invictus", "citizencon", "other"]);
export type EventKind = z.infer<typeof EventKind>;

/**
 * One row of `fixtures/events/registry.json`: which of RSI's pages describe an event. The one
 * file of the module kept by hand, and it holds pointers, never facts (CLAUDE.md section 2).
 */
export const EventSource = z.strictObject({
  slug: Slug,
  kind: EventKind,
  /** RSI's id for the Comm-Link that carries the day-by-day schedule. */
  schedule_comm_link: z.string().regex(/^\d+$/),
  /** Spectrum's id for the staff FAQ thread, read from the news pack; null when there is none. */
  faq_thread: z.string().regex(/^\d+$/).nullable(),
});
export type EventSource = z.infer<typeof EventSource>;

/** A picture on RSI's page, by RSI's own address and alt text; published through the media pipeline. */
export const EventPicture = z.strictObject({
  url: z.url(),
  /** RSI's alt text as given, for example "Galaxy2026". */
  alt: z.string(),
});
export type EventPicture = z.infer<typeof EventPicture>;

/** A ship a day of the show puts on the floor, as RSI lists it. */
export const EventShip = z.strictObject({
  /** RSI's name for it, the maker first: "RSI Galaxy". */
  name: z.string().min(1),
  /** The RSI pledge page the schedule links, absolute; null when the line links none. */
  pledge_url: z.url().nullable(),
  /** RSI's line about the ship, cut to its first sentence; null when there is none. */
  line: z.string().nullable(),
  /** The maker heading the ship stands under on a day with several makers, as RSI wrote it. */
  group: z.string().nullable(),
});
export type EventShip = z.infer<typeof EventShip>;

/** A day of the show, or a run of days RSI gives one entry ("Day 11-15"). */
export const EventDay = z.strictObject({
  /** The day numbers RSI gives: "Day 1" is 1 and 1, "Day 11-15" is 11 and 15. */
  first: z.number().int().positive(),
  last: z.number().int().positive(),
  /** RSI's title for the entry: the makers ("Crusader Industries, Tumbril"), "Best In Show", "Finale". */
  title: z.string().min(1),
  /** The makers as RSI's headings name them, or the title on a day with one maker; empty without one. */
  makers: z.array(z.string().min(1)),
  /** RSI's own dates for the entry, as UTC calendar dates: "November 13-14" is the 13th and 14th. */
  from: z.iso.date(),
  to: z.iso.date(),
  /** The entry's hours: RSI's dates at the show's daily opening time, inside its last day. */
  opens_at: Timestamp,
  closes_at: Timestamp,
  /** RSI's opening sentence for the entry. */
  lead: z.string().nullable(),
  ships: z.array(EventShip),
  /** The ship the entry's banner shows, matched by RSI's picture name ("galaxy2026"); null when none. */
  featured: z.string().nullable(),
  picture: EventPicture.nullable(),
});
export type EventDay = z.infer<typeof EventDay>;

/** A wave of the stock-limited sale: the same hour on every day of a hull's sale. */
export const LimitedWave = z.strictObject({
  number: z.number().int().positive(),
  /** The hour in UTC, "16:00". */
  at: z.string().regex(/^\d{2}:\d{2}$/),
  /** Whether RSI places the wave on the calendar day after the sale's own. */
  next_day: z.boolean(),
});
export type LimitedWave = z.infer<typeof LimitedWave>;

/** A stock-limited hull and the day its waves begin. */
export const LimitedHull = z.strictObject({
  /** RSI's name for it, the maker first: "Origin 890 Jump". */
  name: z.string().min(1),
  /** The first day of its sale, as a UTC date. */
  from: z.iso.date(),
  /** The day of the show RSI names for it, or null. */
  day: z.number().int().positive().nullable(),
});
export type LimitedHull = z.infer<typeof LimitedHull>;

/** Where a fact came from: a Comm-Link or a Spectrum post, at the revision read. */
export const EventSourceRef = z.strictObject({
  kind: z.enum(["comm_link", "spectrum"]),
  external_id: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  published_at: Timestamp,
  /** The news pack's revision read, for a Spectrum post; null for a page read from RSI. */
  revision: z.number().int().positive().nullable(),
});
export type EventSourceRef = z.infer<typeof EventSourceRef>;

/** What RSI's FAQ says about the sale: its waves, its hulls and its price changes, verbatim. */
export const EventSales = z.strictObject({
  waves: z.array(LimitedWave),
  hulls: z.array(LimitedHull),
  /** RSI's sentences on price changes, as written. */
  notes: z.array(z.string().min(1)),
  source: EventSourceRef,
});
export type EventSales = z.infer<typeof EventSales>;

/** One event, as `fixtures/events/<slug>.json` holds it. */
export const EventRecord = z.strictObject({
  slug: Slug,
  kind: EventKind,
  /** RSI's title for the show: "Intergalactic Aerospace Expo 2956". */
  title: z.string().min(1),
  /** RSI's subtitle on the schedule, or null. */
  subtitle: z.string().nullable(),
  /** When the show opens, and its daily opening time. */
  opens_at: Timestamp,
  /** The show's last day, as a UTC date. */
  last_day: z.iso.date(),
  venue: z.strictObject({
    /** The hall, for example "Tobin Expo Center". */
    place: z.string().nullable(),
    city: z.string().nullable(),
    /** The planet or moon. */
    body: z.string().nullable(),
    system: z.string().nullable(),
  }),
  /** RSI's opening sentence for the show. */
  lead: z.string().nullable(),
  picture: EventPicture.nullable(),
  days: z.array(EventDay).min(1),
  /** The stock-limited sale, from the FAQ; null when there is no FAQ or it names no sale. */
  sales: EventSales.nullable(),
  sources: z.array(EventSourceRef).min(1),
  /** The address of the schedule's body on RSI, which changes when RSI edits the page. */
  body_url: z.url(),
  fetched_at: Timestamp,
});
export type EventRecord = z.infer<typeof EventRecord>;

/**
 * Where an event stands at a moment (ADR-057). `before` until the UTC day before it opens; `eve`
 * on that day; `opening` on the day it opens, before the doors open; `day` inside an entry's
 * hours; `after` once its last day is over. The site shows the event on the front page from its
 * eve to the end of its last day (the owner, 2026-11-12: "we can launch it now since IAE is
 * tomorrow").
 */
export type EventPhase =
  | { readonly kind: "before" }
  | { readonly kind: "eve" }
  | { readonly kind: "opening" }
  | { readonly kind: "day"; readonly index: number }
  | { readonly kind: "after" };

const DAY_MS = 86_400_000;

/** UTC midnight of the instant's day, in milliseconds. */
const utcDayStart = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;

/** Where the event stands at `at`: pure, so the site, the fetcher and the tests agree. */
export function eventPhase(
  event: Pick<EventRecord, "opens_at" | "last_day" | "days">,
  at: Date,
): EventPhase {
  const t = at.getTime();
  const opens = Date.parse(event.opens_at);
  const over = Date.parse(`${event.last_day}T00:00:00.000Z`) + DAY_MS;
  if (t >= over) return { kind: "after" };
  if (t < utcDayStart(opens) - DAY_MS) return { kind: "before" };
  if (t < utcDayStart(opens)) return { kind: "eve" };
  if (t < opens) return { kind: "opening" };
  // The latest entry that has opened: entries follow one another, and a gap keeps the last one.
  let index = 0;
  event.days.forEach((day, i) => {
    if (Date.parse(day.opens_at) <= t) index = i;
  });
  return { kind: "day", index };
}

/** A phase as one word, for the fetcher's state file: "before", "eve", "opening", "day-3", "after". */
export function phaseKey(
  event: Pick<EventRecord, "opens_at" | "last_day" | "days">,
  phase: EventPhase,
): string {
  if (phase.kind !== "day") return phase.kind;
  const day = event.days[phase.index];
  return day === undefined ? "day" : `day-${day.first}`;
}

/** Whether the front page carries the event: from its eve (the UTC day before it opens) to the end of its last day. */
export function eventOnFront(
  event: Pick<EventRecord, "opens_at" | "last_day" | "days">,
  at: Date,
): boolean {
  const kind = eventPhase(event, at).kind;
  return kind === "eve" || kind === "opening" || kind === "day";
}

/** The short names CIG uses for its shows. */
export const EVENT_KIND_SHORT: Readonly<Record<EventKind, string | null>> = {
  iae: "IAE",
  invictus: "Invictus",
  citizencon: "CitizenCon",
  other: null,
};

/** "Intergalactic Aerospace Expo 2956" → "IAE 2956"; a show without a short name keeps its title. */
export function eventShortTitle(
  event: Pick<EventRecord, "kind" | "title">,
): string {
  const year = /\b(\d{4})\s*$/.exec(event.title)?.[1];
  const short = EVENT_KIND_SHORT[event.kind];
  return short === null || year === undefined
    ? event.title
    : `${short} ${year}`;
}

/**
 * The show the front page carries at a moment: one that is on (`eventOnFront`), the earliest to
 * open when two overlap; null otherwise.
 */
export function eventForFront<
  T extends Pick<EventRecord, "opens_at" | "last_day" | "days">,
>(list: readonly T[], at: Date): T | null {
  return (
    [...list]
      .filter((e) => eventOnFront(e, at))
      .sort((a, b) => a.opens_at.localeCompare(b.opens_at))[0] ?? null
  );
}
