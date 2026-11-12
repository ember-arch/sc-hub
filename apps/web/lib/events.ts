import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ConceptShip,
  type ContentItem,
  type EventDay,
  EventRecord,
  type EventSales,
  type EventShip,
  EventSource,
  type LimitedHull,
  type Manufacturer,
  EVENT_KIND_SHORT,
  eventForFront,
  eventPhase,
  eventShortTitle,
} from "schema";
import type { ResponsiveImage } from "ui";
import { REPO_ROOT, type Repository, type ShipView } from "./data";
import { media, shipCardImage } from "./media";
import { conceptShips } from "./showcase";

/**
 * The events module (ADR-057): every show in `fixtures/events/`, read from RSI's pages by
 * `scripts/events/fetch.ts`, and the views the event page and the front page's hero draw from
 * it. Pure functions of the record, the register and a moment, so a build is reproducible and a
 * test can pin the day.
 */

const EVENTS_DIR = join(REPO_ROOT, "fixtures", "events");
const PAGE_SOURCES_FILE = join(
  REPO_ROOT,
  "fixtures",
  "rsi-media",
  "sources.json",
);

/** Reads the events on file, in the registry's order, validated; an absent registry is none. */
export function loadEvents(dir: string = EVENTS_DIR): EventRecord[] {
  const registry = join(dir, "registry.json");
  if (!existsSync(registry)) return [];
  const sources = EventSource.array().parse(
    JSON.parse(readFileSync(registry, "utf8")),
  );
  return sources.flatMap((source) => {
    const file = join(dir, `${source.slug}.json`);
    if (!existsSync(file)) return [];
    return [EventRecord.parse(JSON.parse(readFileSync(file, "utf8")))];
  });
}

let cached: readonly EventRecord[] | undefined;

/** Every event on file, the latest to open first. */
export function events(): readonly EventRecord[] {
  cached ??= loadEvents(EVENTS_DIR).sort((a, b) =>
    b.opens_at.localeCompare(a.opens_at),
  );
  return cached;
}

export function eventBySlug(slug: string): EventRecord | undefined {
  return events().find((e) => e.slug === slug);
}

/** The show the front page carries at a moment, from the events on file (`eventForFront`). */
export function frontEvent(
  at: Date,
  list: readonly EventRecord[] = events(),
): EventRecord | null {
  return eventForFront(list, at);
}

/** The short names CIG uses for its shows, and a show's short name: the schema's rules. */
export const KIND_SHORT = EVENT_KIND_SHORT;
export const shortTitle = eventShortTitle;

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

const asDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** "13–14 November", "22 November", "30 November – 1 December"; with the year after when asked. */
export function formatDayRange(
  from: string,
  to: string,
  withYear = false,
): string {
  const a = asDate(from);
  const b = asDate(to);
  const year = withYear ? ` ${b.getUTCFullYear()}` : "";
  if (from === to) return `${DAY_MONTH.format(a)}${year}`;
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${DAY_MONTH.format(b)}${year}`;
  }
  return `${DAY_MONTH.format(a)} – ${DAY_MONTH.format(b)}${year}`;
}

/** The show's dates: "13–27 November 2026". */
export function eventDates(event: EventRecord): string {
  const first = event.days[0]!.from;
  return formatDayRange(first, event.last_day, true);
}

/** "16:00 UTC". */
export function formatUtcTime(iso: string): string {
  return `${TIME.format(new Date(iso))} UTC`;
}

/** "13 November, 16:00 UTC". */
export function formatUtcMoment(iso: string): string {
  return `${DAY_MONTH.format(new Date(iso))}, ${formatUtcTime(iso)}`;
}

/** "13 November 2026". */
export function formatLongDay(day: string): string {
  return DAY_MONTH_YEAR.format(asDate(day));
}

/** "Day 1", "Days 11–15". */
export function dayLabel(day: Pick<EventDay, "first" | "last">): string {
  return day.first === day.last
    ? `Day ${day.first}`
    : `Days ${day.first}–${day.last}`;
}

/** How many days the show runs, by RSI's numbering. */
export function dayCount(event: EventRecord): number {
  return event.days.reduce((n, d) => Math.max(n, d.last), 0);
}

/** The in-page address of a day: `day-1`, `day-11`. */
export function dayAnchor(day: Pick<EventDay, "first">): string {
  return `day-${day.first}`;
}

/** A day's standing at a moment: over, on now, the next to open, or later. */
export type DayStatus = "past" | "now" | "next" | "later";

export function dayStatuses(event: EventRecord, at: Date): DayStatus[] {
  const phase = eventPhase(event, at);
  if (phase.kind === "after") return event.days.map(() => "past");
  if (phase.kind !== "day") {
    return event.days.map((_, i) => (i === 0 ? "next" : "later"));
  }
  return event.days.map((_, i) =>
    i < phase.index
      ? "past"
      : i === phase.index
        ? "now"
        : i === phase.index + 1
          ? "next"
          : "later",
  );
}

/**
 * The day to lead with: the one on now; before the doors open the first; once the show is over,
 * none.
 */
export function leadDay(event: EventRecord, at: Date): EventDay | null {
  const phase = eventPhase(event, at);
  if (phase.kind === "after") return null;
  if (phase.kind === "day") return event.days[phase.index] ?? null;
  return event.days[0] ?? null;
}

const squash = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\b(?:and|&)\b|&/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** "GATAC MANUFACTURE" → "Gatac Manufacture": RSI's capitals, set as a name. */
function asName(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(
      /(^|[\s-])([a-z])/g,
      (_, a: string, b: string) => a + b.toUpperCase(),
    );
}

/** A maker as RSI names it on the schedule, matched to the register's manufacturer when it is one. */
export interface EventMaker {
  readonly name: string;
  readonly manufacturer: Manufacturer | null;
}

export function eventMaker(
  raw: string,
  manufacturers: readonly Manufacturer[],
): EventMaker {
  const key = squash(raw);
  const manufacturer =
    manufacturers.find((m) => squash(m.name) === key) ??
    manufacturers.find((m) => squash(m.code) === key) ??
    null;
  return { name: manufacturer?.name ?? asName(raw), manufacturer };
}

/** A ship on the schedule as the site shows it: linked to its entry when the register has one. */
export interface EventShipView {
  readonly name: string;
  /** RSI's line about it, cut to its first sentence. */
  readonly line: string | null;
  readonly group: string | null;
  /** The register's slug, or null when the register lacks it. */
  readonly slug: string | null;
  /** The ship's page here, or RSI's pledge page when the register lacks it. */
  readonly href: string | null;
  readonly external: boolean;
  /** The register's status: "Flight ready", "In concept"… */
  readonly status: string | null;
  readonly picture: ResponsiveImage | null;
  /** The large picture the ship's own page opens on, for a banner. */
  readonly banner: ResponsiveImage | null;
}

const STATUS_LABEL: Readonly<Record<string, string>> = {
  flight_ready: "Flight ready",
  in_production: "In production",
  concept: "In concept",
};

/** RSI's address as a key: the path, lower case, without the `/en` RSI adds and a trailing slash. */
export function pageKey(url: string): string {
  return new URL(url).pathname
    .toLowerCase()
    .replace(/^\/en(?=\/)/, "")
    .replace(/\/+$/, "");
}

interface PageSource {
  readonly class_name: string;
  readonly page_url: string;
}

/** A ship's entry rather than its display copy or an edition of it. */
const entryRank = (ship: ShipView): number =>
  (ship.editionOf === null ? 0 : 2) +
  (/_display$/i.test(ship.vehicle.class_name) ? 1 : 0);

/**
 * Resolves the schedule's ships against the register: by the RSI pledge page the schedule links
 * (`fixtures/rsi-media/sources.json` records the page of every ship-matrix ship, the concepts'
 * pages are on their records), then by name, RSI's name ending in the register's with the ship's
 * own maker before it ("RSI Aurora Mk II" is the Aurora Mk II, "Aegis Aurora Mk II" is not), the
 * longest such name winning. A ship neither finds keeps RSI's link.
 */
export function shipResolver(
  r: Pick<Repository, "entries" | "manufacturers">,
  concepts: readonly ConceptShip[] = conceptShips(),
  pageSources: readonly PageSource[] = loadPageSources(),
): (ship: EventShip) => EventShipView {
  const byClass = new Map(r.entries.map((s) => [s.vehicle.class_name, s]));
  const byPage = new Map<string, ShipView>();
  for (const source of pageSources) {
    const ship = byClass.get(source.class_name);
    if (ship === undefined) continue;
    const key = pageKey(source.page_url);
    const seen = byPage.get(key);
    if (seen === undefined || entryRank(ship) < entryRank(seen))
      byPage.set(key, ship);
  }
  const conceptByPage = new Map(concepts.map((c) => [pageKey(c.page_url), c]));
  const makers = new Map(r.manufacturers.map((m) => [m.code, m]));
  const ranked = [...r.entries].sort(
    (a, b) =>
      b.vehicle.name.length - a.vehicle.name.length ||
      entryRank(a) - entryRank(b),
  );
  const conceptsRanked = [...concepts].sort(
    (a, b) => b.name.length - a.name.length,
  );
  const ofShip = (ship: ShipView, entry: EventShip): EventShipView => ({
    name: entry.name,
    line: entry.line,
    group: entry.group,
    slug: ship.vehicle.slug,
    href: `/ships/${ship.vehicle.slug}`,
    external: false,
    status: STATUS_LABEL[ship.vehicle.status] ?? null,
    picture: shipCardImage(ship),
    banner: media().showcaseCard(ship.vehicle.slug) ?? shipCardImage(ship),
  });
  const ofConcept = (c: ConceptShip, entry: EventShip): EventShipView => {
    const picture =
      media().concept(c.slug, null) ?? media().showcaseCard(c.slug);
    return {
      name: entry.name,
      line: entry.line,
      group: entry.group,
      slug: c.slug,
      href: `/ships/${c.slug}`,
      external: false,
      status: STATUS_LABEL["concept"]!,
      picture,
      banner: media().showcaseCard(c.slug) ?? picture,
    };
  };
  return (entry) => {
    if (entry.pledge_url !== null) {
      const key = pageKey(entry.pledge_url);
      const ship = byPage.get(key);
      if (ship !== undefined) return ofShip(ship, entry);
      const concept = conceptByPage.get(key);
      if (concept !== undefined) return ofConcept(concept, entry);
    }
    const name = squash(entry.name);
    // RSI's name ends in the register's, and what stands before it is the ship's own maker
    // (its code, or the start of its name: "Greycat" for Greycat Industrial), or nothing.
    const named = (candidate: string, makerCode: string): boolean => {
      const n = squash(candidate);
      if (n.length < 2 || !name.endsWith(n)) return false;
      const prefix = name.slice(0, name.length - n.length);
      if (prefix === "") return true;
      const maker = makers.get(makerCode);
      return (
        prefix === squash(makerCode) ||
        (maker !== undefined && squash(maker.name).startsWith(prefix))
      );
    };
    const ship = ranked.find((s) =>
      named(s.vehicle.name, s.vehicle.manufacturer_code),
    );
    if (ship !== undefined) return ofShip(ship, entry);
    const concept = conceptsRanked.find((c) =>
      named(c.name, c.manufacturer_code),
    );
    if (concept !== undefined) return ofConcept(concept, entry);
    return {
      name: entry.name,
      line: entry.line,
      group: entry.group,
      slug: null,
      href: entry.pledge_url,
      external: entry.pledge_url !== null,
      status: null,
      picture: null,
      banner: null,
    };
  };
}

let pageSources: readonly PageSource[] | undefined;

function loadPageSources(): readonly PageSource[] {
  pageSources ??= existsSync(PAGE_SOURCES_FILE)
    ? (JSON.parse(readFileSync(PAGE_SOURCES_FILE, "utf8")) as PageSource[])
    : [];
  return pageSources;
}

/**
 * The picture for a day: the one its RSI banner names, the featured ship's own opening picture;
 * else the first of the day's ships with one. Best in Show has no list, so its featured ship is
 * looked up across the show.
 */
export function dayBanner(
  day: EventDay,
  event: EventRecord,
  resolve: (ship: EventShip) => EventShipView,
): { picture: ResponsiveImage; ship: EventShipView } | null {
  const pool =
    day.ships.length > 0 ? day.ships : event.days.flatMap((d) => d.ships);
  const featured =
    day.featured === null
      ? undefined
      : pool.find((s) => s.name === day.featured);
  const order = featured === undefined ? day.ships : [featured, ...day.ships];
  for (const entry of order) {
    const view = resolve(entry);
    const picture = view.banner ?? view.picture;
    if (picture !== null) return { picture, ship: view };
  }
  return null;
}

/** A banner for the show itself when no day has one: the first day's, or any day's. */
export function eventBanner(
  event: EventRecord,
  day: EventDay | null,
  resolve: (ship: EventShip) => EventShipView,
): { picture: ResponsiveImage; ship: EventShipView } | null {
  const order = day === null ? event.days : [day, ...event.days];
  for (const d of order) {
    const banner = dayBanner(d, event, resolve);
    if (banner !== null) return banner;
  }
  return null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * The moments of a hull's waves on its first day: wave 1 at its hour on the sale's date, each
 * later wave the first time its hour comes round after the one before ("00:00" after "20:00" is
 * the next calendar day, as RSI's note says some waves are).
 */
export function waveMoments(
  sales: Pick<EventSales, "waves">,
  hull: Pick<LimitedHull, "from">,
): string[] {
  const start = Date.parse(`${hull.from}T00:00:00.000Z`);
  const out: number[] = [];
  for (const wave of [...sales.waves].sort((a, b) => a.number - b.number)) {
    const [h = 0, m = 0] = wave.at.split(":").map(Number);
    let t = start + h * HOUR_MS + m * 60_000;
    const previous = out[out.length - 1];
    while (previous !== undefined && t <= previous) t += DAY_MS;
    out.push(t);
  }
  return out.map((t) => new Date(t).toISOString());
}

/** The hulls grouped by their first day, in order. */
export function hullsByDay(
  sales: EventSales,
): { from: string; day: number | null; hulls: LimitedHull[] }[] {
  const groups = new Map<
    string,
    { from: string; day: number | null; hulls: LimitedHull[] }
  >();
  for (const hull of sales.hulls) {
    const group = groups.get(hull.from) ?? {
      from: hull.from,
      day: hull.day,
      hulls: [],
    };
    group.hulls.push(hull);
    groups.set(hull.from, group);
  }
  return [...groups.values()].sort((a, b) => a.from.localeCompare(b.from));
}

/** The hulls whose waves start on a day of the show. */
export function hullsOn(
  sales: EventSales | null,
  day: EventDay,
): LimitedHull[] {
  if (sales === null) return [];
  return sales.hulls.filter((h) => h.from === day.from);
}

/** A limited hull as the register knows it, by RSI's name for it, for a tile. */
export function hullResolver(
  resolve: (ship: EventShip) => EventShipView,
): (name: string) => EventShipView {
  return (name) => resolve({ name, pledge_url: null, line: null, group: null });
}

/**
 * The dispatches about a show: Comm-Links and videos whose title or summary names it (its title
 * or short name), and every Comm-Link published while it runs; newest first.
 */
export function eventNews(
  event: EventRecord,
  dispatches: readonly ContentItem[],
  limit = 12,
): ContentItem[] {
  const names = [event.title, shortTitle(event)].map((n) => n.toLowerCase());
  const opens = Date.parse(`${event.days[0]!.from}T00:00:00.000Z`);
  const over = Date.parse(`${event.last_day}T00:00:00.000Z`) + DAY_MS;
  return dispatches
    .filter((item) => {
      if (item.source !== "comm_link" && item.source !== "video") return false;
      const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();
      if (names.some((n) => text.includes(n))) return true;
      const t = Date.parse(item.published_at);
      return item.source === "comm_link" && t >= opens && t < over;
    })
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}
