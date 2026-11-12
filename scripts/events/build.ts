/**
 * From RSI's schedule and FAQ to one event record (ADR-057): pure, so the fixture tests run on
 * the real pages of 2026-11-12 with no network. Every field is RSI's: the dates and the daily
 * opening time are RSI's words, a day's makers are its headings, a ship's line is its first
 * sentence, a wave is the FAQ's own line. A fact RSI does not give stays null.
 */
import {
  type EventDay,
  type EventPicture,
  EventRecord,
  type EventSales,
  type EventSource,
  type EventSourceRef,
  type LimitedHull,
  type LimitedWave,
} from "schema";
import {
  type BodyPicture,
  type DayLabel,
  EventShapeError,
  type MonthDay,
  type ScheduleBody,
  firstSentence,
  monthOf,
  parseDayHtml,
  dayLabel,
  plainText,
} from "./parse.js";

const DAY_MS = 86_400_000;

/**
 * The year RSI means by a month and day it writes without one: the year of the page's
 * publication, or the next or previous one when the month is more than half a year away (a
 * schedule for January published in December).
 */
export function yearFor(md: MonthDay, published: Date): number {
  const year = published.getUTCFullYear();
  const delta = md.month - (published.getUTCMonth() + 1);
  if (delta < -6) return year + 1;
  if (delta > 6) return year - 1;
  return year;
}

/** A month and day at an hour and minute in UTC, in the year RSI means. */
function instant(
  md: MonthDay,
  published: Date,
  hour: number,
  minute: number,
): number {
  return Date.UTC(yearFor(md, published), md.month - 1, md.day, hour, minute);
}

const iso = (ms: number): string => new Date(ms).toISOString();

/** The show's opening: "November 13, 16:00 UTC" or "November 13 at 16:00 UTC", first found. */
export function openingOf(
  texts: readonly string[],
): { md: MonthDay; hour: number; minute: number } | null {
  for (const text of texts) {
    const m =
      /\b([A-Z][a-z]+)\s+(\d{1,2}),?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*UTC\b/.exec(
        text,
      );
    if (m === null) continue;
    const month = monthOf(m[1] ?? "");
    if (month === null) continue;
    return {
      md: { month, day: Number(m[2]) },
      hour: Number(m[3]),
      minute: Number(m[4]),
    };
  }
  return null;
}

/** "Join us in New Babbage on microTech, system Stanton": the city, the body and the system. */
export function placeOf(texts: readonly string[]): {
  city: string | null;
  body: string | null;
  system: string | null;
} {
  for (const text of texts) {
    const m =
      /\bin ([A-Z][\w’']*(?: [A-Z][\w’']*)*) on ([A-Za-z][\w’']*),? (?:system|in the) ([A-Z][A-Za-z]+)(?: system)?\b/.exec(
        text,
      );
    if (m !== null) {
      return { city: m[1] ?? null, body: m[2] ?? null, system: m[3] ?? null };
    }
  }
  return { city: null, body: null, system: null };
}

/**
 * The hall: the most often named "the … Center" (or Centre, Hall, Arena, Pavilion) across the
 * pages, the longer name on a tie ("Tobin Expo Center" over "Tobin Center").
 */
export function hallOf(texts: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const m of text.matchAll(
      /\b(?:at|in) the ((?:[A-Z][\w’']*\s)+?(?:Center|Centre|Hall|Arena|Pavilion))\b/g,
    )) {
      const name = (m[1] ?? "").trim();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && best !== null && name.length > best.length)
    ) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

const squashed = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * The ship a banner shows, by RSI's picture name: "Galaxy2026" is the Galaxy, "m80" the M80. The
 * name loses a trailing year; the first listed ship whose squashed name ends with it wins; none,
 * null.
 */
export function featuredOf(
  picture: BodyPicture | null,
  ships: readonly { readonly name: string }[],
): string | null {
  if (picture === null || picture.alt === "") return null;
  const token = squashed(picture.alt).replace(/(?:19|20)\d\d$/, "");
  if (token.length < 3) return null;
  return ships.find((s) => squashed(s.name).endsWith(token))?.name ?? null;
}

/** A Comm-Link as the news pack has it: the publication time the year is read against. */
export interface CommLinkMeta {
  readonly external_id: string;
  readonly url: string;
  readonly title: string;
  readonly published_at: string;
}

/** A Spectrum post as the news pack has it, at its latest revision. */
export interface FaqPost {
  readonly external_id: string;
  readonly url: string;
  readonly title: string;
  readonly published_at: string;
  readonly revision: number;
  readonly body_html: string;
}

/** The FAQ's paragraphs and list lines as text. */
function blocksOf(html: string): string[] {
  return [...html.matchAll(/<(p|li|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => plainText(m[2] ?? ""))
    .filter((t) => t !== "");
}

/**
 * The sale in RSI's FAQ: "Wave 1 - 16:00 UTC", "Wave 4 - 04:00 UTC (the following day)",
 * "Starting on November 14 (IAE Day 2): Origin 890 Jump", and the sentences on price changes.
 * A FAQ that speaks of waves or stock-limited ships and yields none of them halts the run.
 */
export function parseFaq(
  post: FaqPost,
  published: Date,
): Omit<EventSales, "source"> | null {
  const blocks = blocksOf(post.body_html);
  const waves: LimitedWave[] = [];
  const hulls: LimitedHull[] = [];
  const notes: string[] = [];
  for (const text of blocks) {
    const wave =
      /^\W*Wave\s+(\d+)\s*[-–:]\s*(\d{1,2}):(\d{2})\s*UTC\s*(\(the following day\))?\s*$/i.exec(
        text,
      );
    if (wave !== null) {
      waves.push({
        number: Number(wave[1]),
        at: `${(wave[2] ?? "").padStart(2, "0")}:${wave[3]}`,
        next_day: wave[4] !== undefined,
      });
      continue;
    }
    const hull =
      /^\W*Starting on ([A-Za-z]+) (\d{1,2})(?:\s*\((?:[A-Z0-9]+\s+)?Day (\d+)\))?\s*:\s*(.+)$/i.exec(
        text,
      );
    if (hull !== null) {
      const month = monthOf(hull[1] ?? "");
      if (month === null) {
        throw new EventShapeError("a sale line with a month it cannot read", {
          line: text,
        });
      }
      const md = { month, day: Number(hull[2]) };
      const from = new Date(instant(md, published, 0, 0))
        .toISOString()
        .slice(0, 10);
      const day = hull[3] === undefined ? null : Number(hull[3]);
      for (const name of (hull[4] ?? "").split(
        /\s*,\s*(?:and\s+)?|\s+and\s+/,
      )) {
        const n = name.trim().replace(/\.$/, "");
        if (n !== "") hulls.push({ name: n, from, day });
      }
      continue;
    }
    if (/\bprice\b/i.test(text) && /\$\d/.test(text)) {
      notes.push(firstSentence(text));
    }
  }
  const speaks = blocks.some((t) =>
    /\bwaves?\b|stock-limited|limited ships?/i.test(t),
  );
  if (waves.length === 0 && hulls.length === 0) {
    if (speaks && blocks.some((t) => /^\W*Wave\s+\d/i.test(t))) {
      throw new EventShapeError("the FAQ lists waves this module cannot read", {
        post: post.external_id,
      });
    }
    return notes.length === 0 ? null : { waves, hulls, notes };
  }
  if (waves.length === 0 || hulls.length === 0) {
    throw new EventShapeError(
      "the FAQ names a stock-limited sale without both its waves and its hulls",
      { post: post.external_id, waves: waves.length, hulls: hulls.length },
    );
  }
  return { waves, hulls, notes };
}

const pictureRecord = (p: BodyPicture | null): EventPicture | null =>
  p === null ? null : { url: p.url, alt: p.alt };

/** The window of a day label at the show's daily opening time, inside the show's last day. */
function windowOf(
  label: DayLabel,
  published: Date,
  hour: number,
  minute: number,
  showEnds: number,
): { opens: number; closes: number } {
  const opens = instant(label.from, published, hour, minute);
  const to = instant(label.to, published, hour, minute);
  // "Day 1, November 13-14" closes on its second date; "Day 10, November 22" a day after its
  // one; "Day 11-15, November 23-27" names the first and last days' own dates.
  const closes = label.last > label.first || to === opens ? to + DAY_MS : to;
  return { opens, closes: Math.min(closes, showEnds) };
}

export interface BuildInput {
  readonly source: EventSource;
  readonly commLink: CommLinkMeta;
  readonly bodyUrl: string;
  readonly body: ScheduleBody;
  readonly faq: FaqPost | null;
  readonly fetchedAt: Date;
}

/** One event record from RSI's schedule body and FAQ; validated against `EventRecord`. */
export function buildEvent(input: BuildInput): EventRecord {
  const { source, commLink, body, faq } = input;
  const published = new Date(commLink.published_at);
  if (Number.isNaN(published.getTime())) {
    throw new EventShapeError("the Comm-Link has no publication time", {
      id: commLink.external_id,
    });
  }
  const introText = body.intro.map(plainText);
  const entryTexts = body.entries.map((e) => plainText(e.html));
  const faqText = faq === null ? [] : blocksOf(faq.body_html);

  const labelled = body.entries.flatMap((entry) => {
    if (entry.subtitle === null) return [];
    const label = dayLabel(entry.subtitle);
    return label === null ? [] : [{ entry, label }];
  });
  if (labelled.length === 0) {
    throw new EventShapeError("the schedule has no day", {
      entries: body.entries.map((e) => e.title),
    });
  }
  const opening = openingOf([...introText, ...entryTexts, ...faqText]);
  if (opening === null) {
    throw new EventShapeError(
      "neither the schedule nor the FAQ gives the opening hour in UTC",
    );
  }
  const lastTo = labelled
    .map(({ label }) => instant(label.to, published, 0, 0))
    .reduce((a, b) => Math.max(a, b));
  const showEnds = lastTo + DAY_MS;
  const allShips = labelled.flatMap(
    ({ entry }) => parseDayHtml(entry.html, entry.title).ships,
  );

  const days: EventDay[] = labelled.map(({ entry, label }, i) => {
    const day = parseDayHtml(entry.html, `${entry.title} (${entry.subtitle})`);
    const previous = labelled[i - 1];
    if (previous !== undefined && label.first <= previous.label.last) {
      throw new EventShapeError("the schedule's days are out of order", {
        entry: entry.subtitle,
      });
    }
    const w = windowOf(
      label,
      published,
      opening.hour,
      opening.minute,
      showEnds,
    );
    const makers =
      day.groups.length > 0
        ? [...day.groups]
        : day.ships.length > 0
          ? [entry.title]
          : [];
    return {
      first: label.first,
      last: label.last,
      title: entry.title,
      makers,
      from: iso(instant(label.from, published, 0, 0)).slice(0, 10),
      to: iso(instant(label.to, published, 0, 0)).slice(0, 10),
      opens_at: iso(w.opens),
      closes_at: iso(w.closes),
      lead: day.lead,
      ships: day.ships.map((s) => ({
        name: s.name,
        pledge_url: s.url,
        line: s.line,
        group: s.group,
      })),
      featured: featuredOf(
        entry.picture,
        day.ships.length > 0 ? day.ships : allShips,
      ),
      picture: pictureRecord(entry.picture),
    };
  });

  const opensAt = instant(opening.md, published, opening.hour, opening.minute);
  if (Math.abs(opensAt - Date.parse(days[0]!.opens_at)) > DAY_MS) {
    throw new EventShapeError(
      "the opening hour and the first day's date disagree",
      { opening: iso(opensAt), first: days[0]!.opens_at },
    );
  }
  const place = placeOf([...introText, ...entryTexts, ...faqText]);
  const sources: EventSourceRef[] = [
    {
      kind: "comm_link",
      external_id: commLink.external_id,
      url: commLink.url,
      title: commLink.title,
      published_at: commLink.published_at,
      revision: null,
    },
  ];
  let sales: EventSales | null = null;
  if (faq !== null) {
    const faqRef: EventSourceRef = {
      kind: "spectrum",
      external_id: faq.external_id,
      url: faq.url,
      title: faq.title,
      published_at: faq.published_at,
      revision: faq.revision,
    };
    sources.push(faqRef);
    const parsed = parseFaq(faq, new Date(faq.published_at));
    sales = parsed === null ? null : { ...parsed, source: faqRef };
  }
  const lead = introText[0] === undefined ? null : firstSentence(introText[0]);

  return EventRecord.parse({
    slug: source.slug,
    kind: source.kind,
    title: body.title,
    subtitle: body.subtitle,
    opens_at: iso(opensAt),
    last_day: iso(lastTo).slice(0, 10),
    venue: {
      place: hallOf([...entryTexts, ...faqText, ...introText]),
      ...place,
    },
    lead,
    picture: pictureRecord(body.picture),
    days,
    sales,
    sources,
    body_url: input.bodyUrl,
    fetched_at: input.fetchedAt.toISOString(),
  });
}
