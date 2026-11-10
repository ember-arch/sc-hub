/**
 * Comm-Links (spec 03, ADR-027). RSI's Comm-Link hub page lists the newest transmissions as
 * server-rendered blocks (the transmission pages themselves are an app shell with no text), so
 * the hub is what the poller reads to learn what is new: one request every run. A new entry
 * becomes an item at once from what the hub says (title, blurb, kind, "8 hours ago"), so the
 * feed carries it within the run; the text, images and exact publication time then come from
 * the Star Citizen Wiki API's record of the same Comm-Link (credited wherever it is shown,
 * CLAUDE.md section 9), which revises the item when the wiki has it. The wiki is asked once a
 * run for each item still without its text, for a fortnight after the item appeared.
 */
import { z } from "zod";
import type { Client } from "../client.js";
import {
  decodeEntities,
  escapeHtml,
  firstParagraph,
  paragraphsHtml,
} from "../html.js";
import type { Incoming, Store } from "../store.js";

export const RSI_ORIGIN = "https://robertsspaceindustries.com";
export const HUB_URL = `${RSI_ORIGIN}/en/comm-link`;
export const WIKI_API = "https://api.star-citizen.wiki/api/v2";
/** How long an item keeps asking the wiki for its text. */
export const WIKI_PATIENCE_MS = 14 * 24 * 60 * 60 * 1000;

export interface HubEntry {
  /** RSI's own id, the number that starts the transmission's path. */
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly kind: string;
  /** The hub's blurb, when it has one; the item's summary until the wiki's text arrives. */
  readonly blurb: string | null;
  /** "8 hours ago", as the hub writes it. */
  readonly timeAgo: string | null;
}

export class HubShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubShapeError";
  }
}

const clean = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

/** The hub's blocks, newest first as the page lists them; halts when the page has none. */
export function parseHub(html: string): HubEntry[] {
  const blocks =
    html.match(/<a class="content-block2 hub-block[\s\S]*?<\/a>/g) ?? [];
  if (blocks.length === 0) {
    throw new HubShapeError("comm-link hub: no transmission block on the page");
  }
  const entries: HubEntry[] = [];
  for (const block of blocks) {
    const href = /href="(\/comm-link\/transmission\/(\d+)-[^"]*)"/.exec(block);
    const title = /<div class="title[^"]*">([\s\S]*?)<\/div>/.exec(block);
    if (href === null || title === null) continue;
    const kind = /<div class="type ([a-z]+)">/.exec(block)?.[1] ?? "post";
    const blurb = /<div class="body">\s*<p>([\s\S]*?)<\/p>/.exec(block)?.[1];
    const timeAgo = /class="time_ago">Posted: <span class="value">([^<]*)/.exec(
      block,
    )?.[1];
    const name = clean(title[1]!);
    if (name === "") continue;
    entries.push({
      id: href[2]!,
      path: href[1]!,
      title: name,
      kind,
      blurb: blurb === undefined ? null : clean(blurb) || null,
      timeAgo: timeAgo?.trim() ?? null,
    });
  }
  if (entries.length === 0) {
    throw new HubShapeError(
      "comm-link hub: blocks found but none links a titled transmission",
    );
  }
  return entries;
}

const UNITS: Readonly<Record<string, number>> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  year: 365 * 86_400_000,
};

/**
 * "8 hours ago" as a time: the run's time less the hub's figure, cut to the hub's own precision
 * (the hour for hours, the day for days and longer), so the figure is what the hub said and no
 * more. Null when the hub's words are not of that form; the wiki's exact time replaces it anyway.
 */
export function timeFromAgo(timeAgo: string | null, now: Date): Date | null {
  if (timeAgo === null) return null;
  const m =
    /^(\d+|an?)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(
      timeAgo.trim(),
    );
  if (m === null) return null;
  const count = /^an?$/i.test(m[1]!) ? 1 : Number(m[1]);
  const unit = m[2]!.toLowerCase();
  const span = UNITS[unit]!;
  const at = now.getTime() - count * span;
  const grain =
    unit === "second" || unit === "minute"
      ? 60_000
      : unit === "hour"
        ? 3_600_000
        : 86_400_000;
  return new Date(Math.floor(at / grain) * grain);
}

/** A content item from the hub alone: what RSI's listing says, until the wiki's text arrives. */
export function fromHub(entry: HubEntry, now: Date): Incoming {
  const when = timeFromAgo(entry.timeAgo, now) ?? now;
  return {
    source: "comm_link",
    external_id: entry.id,
    url: `${RSI_ORIGIN}${entry.path}`,
    title: entry.title,
    summary: entry.blurb,
    body_html: entry.blurb === null ? "" : `<p>${escapeHtml(entry.blurb)}</p>`,
    published_at: when.toISOString(),
    author_id: null,
    thread_id: null,
    thread_title: null,
    forum: null,
  };
}

/** The wiki's record of one Comm-Link: the fields this project reads; anything else halts. */
export const WikiCommLink = z.object({
  data: z.object({
    id: z.number().int(),
    title: z.string().min(1),
    rsi_url: z.url(),
    channel: z.string().nullable(),
    category: z.string().nullable(),
    series: z.string().nullable(),
    created_at: z.string().min(1),
    translations: z.object({ en_EN: z.string() }).loose(),
  }),
});
export type WikiCommLink = z.infer<typeof WikiCommLink>;

/** An upload's file name the wiki writes into the text where a video or picture stood: one word, either long with an underscore in it, or three or more capitalised parts joined by hyphens or run together; prose has no such words. */
const ASSET_NAME =
  /^(?:(?=.*_)[A-Za-z0-9_-]{12,}|(?:[A-Z][A-Za-z0-9]*-){2,}[A-Z][A-Za-z0-9]*|(?:[A-Z][a-z0-9]+){3,})(?:\.[a-z0-9]{2,4})?$/;

/** A CSS fragment the wiki writes where a styled banner stood ("linear-gradient(to bottom, #000000 0%, ...)"). */
const CSS_FUNCTION = /\b[a-z-]*(?:gradient|url)\([^)]*\)\s*/g;

/** Filler the wiki's record carries when nobody has transcribed the Comm-Link yet. */
const PLACEHOLDER =
  /lorem ipsum|nemo enim ipsam|duis aute irure|consectetur adipisc|sed ut perspiciatis|ut enim ad minim/i;

/** True when the text is the wiki's filler rather than the Comm-Link; the hub's blurb stands instead. */
export function isPlaceholderText(text: string): boolean {
  return PLACEHOLDER.test(text);
}

/**
 * The wiki's text with its flattening undone where it can be: it writes a heading's level as a
 * bare token ("h2 h3 Jump Point Now Available!"), a video's or picture's file name where the
 * media stood ("VEH2618_MK5Trailer_FALLBACK_H264_1920x860_261014"), and repeats the title at the
 * top. Those go, at the start of a line; then a leading repetition of the title; nothing else is
 * touched.
 */
export function cleanWikiText(text: string, title: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(CSS_FUNCTION, "")
    .split("\n")
    .map(cleanLineStart);
  let body = lines.join("\n").trim();
  if (body.startsWith(title)) {
    // The title and the banner's file name often share the first line; clean its start again.
    body = cleanLineStart(body.slice(title.length).replace(/^[\s:.!–-]+/, ""));
  }
  return body;
}

/** Heading tokens and upload names at the start of a line, however many. */
function cleanLineStart(line: string): string {
  let rest = line.replace(/^(?:h[1-6]\s+)+/, "");
  for (;;) {
    const first = /^(\S+)\s*/.exec(rest);
    if (first === null || !ASSET_NAME.test(first[1]!)) break;
    rest = rest.slice(first[0].length);
  }
  return rest.replace(/^(?:h[1-6]\s+)+/, "");
}

/** The item with the wiki's text as paragraphs, its first paragraph, and the wiki's exact time. */
export function fromWiki(record: WikiCommLink, entry: HubEntry): Incoming {
  const text = cleanWikiText(record.data.translations.en_EN, record.data.title);
  // Filler in place of the text: the item keeps the hub's blurb, as fromHub wrote it.
  const body = isPlaceholderText(text) ? "" : text;
  return {
    source: "comm_link",
    external_id: String(record.data.id),
    url: `${RSI_ORIGIN}${entry.path}`,
    title: entry.title,
    summary: firstParagraph(body) ?? entry.blurb,
    body_html:
      body === ""
        ? entry.blurb === null
          ? ""
          : `<p>${escapeHtml(entry.blurb)}</p>`
        : paragraphsHtml(body),
    published_at: new Date(record.data.created_at).toISOString(),
    author_id: null,
    thread_id: null,
    thread_title: null,
    forum: null,
  };
}

/** Which Comm-Links have their wiki text, and when each was last asked for. */
export const CommLinkState = z.record(
  z.string(),
  z.object({
    wiki: z.boolean(),
    first_seen: z.string(),
  }),
);
export type CommLinkState = z.infer<typeof CommLinkState>;

export interface PollSummary {
  readonly seen: number;
  readonly asked: number;
  readonly added: number;
  readonly revised: number;
  /** Hub entries the wiki does not have yet; tried again next run. */
  readonly waiting: readonly string[];
  /**
   * Items the store refused as older than the news window (ADR-031): a hub entry dated before
   * it, or a wiki record whose time is before it (the wiki's import time stands in for RSI's on
   * some records); such an item keeps the hub's words and time and is not asked for again.
   */
  readonly older: number;
}

/** One run: the hub, an item for every new entry, then the wiki for every item still without its text. */
export async function pollCommLinks(
  client: Client,
  store: Store,
  state: { read(): CommLinkState; write(next: CommLinkState): void },
  now: () => Date,
  options: { readonly log?: (e: Record<string, unknown>) => void } = {},
): Promise<PollSummary> {
  const log = options.log ?? (() => undefined);
  const entries = parseHub(await client.text(HUB_URL));
  const known = state.read();
  const waiting: string[] = [];
  let asked = 0;
  let older = 0;
  const before = { added: store.added, revised: store.revised };
  for (const entry of entries) {
    const at = now();
    if (store.find("comm_link", entry.id) === undefined) {
      const outcome = store.put(fromHub(entry, at), at.toISOString());
      known[entry.id] = { wiki: false, first_seen: at.toISOString() };
      log({ event: "news.comm_link.hub", id: entry.id, outcome });
      if (outcome === "older") {
        older += 1;
        continue;
      }
    }
    const status = known[entry.id] ?? {
      wiki: false,
      first_seen: at.toISOString(),
    };
    known[entry.id] = status;
    if (status.wiki) continue;
    if (at.getTime() - new Date(status.first_seen).getTime() > WIKI_PATIENCE_MS)
      continue;
    asked += 1;
    let json: unknown;
    try {
      json = await client.json(`${WIKI_API}/comm-links/${entry.id}`);
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        waiting.push(entry.id);
        log({ event: "news.comm_link.waiting", id: entry.id });
        continue;
      }
      throw error;
    }
    const record = WikiCommLink.parse(json);
    const outcome = store.put(fromWiki(record, entry), now().toISOString());
    known[entry.id] = { ...status, wiki: true };
    log({ event: "news.comm_link.wiki", id: entry.id, outcome });
    if (outcome === "older") older += 1;
  }
  state.write(known);
  return {
    seen: entries.length,
    asked,
    added: store.added - before.added,
    revised: store.revised - before.revised,
    waiting,
    older,
  };
}

/**
 * One page of the wiki's Comm-Link list: the same records, thirty a page, newest first. The wiki
 * keeps some records with no text at all (`translations` null: placeholder entries such as the
 * sale posts' asset names); those are listed, not Comm-Links to show, and are skipped.
 */
export const WikiCommLinkList = z.object({
  data: z.array(
    WikiCommLink.shape.data.extend({
      translations: z.object({ en_EN: z.string() }).loose().nullable(),
    }),
  ),
  meta: z.object({
    current_page: z.number().int(),
    last_page: z.number().int(),
  }),
});

/** A hub entry made from the wiki's record alone, for a Comm-Link the hub no longer lists. */
export function entryFromRecord(
  record: Pick<WikiCommLink["data"], "id" | "title" | "rsi_url">,
): HubEntry {
  const path = new URL(record.rsi_url).pathname.replace(
    /^\/[a-z]{2}(?=\/)/,
    "",
  );
  return {
    id: String(record.id),
    path,
    title: record.title,
    kind: "post",
    blurb: null,
    timeAgo: null,
  };
}

export interface BackfillSummary {
  readonly pages: number;
  readonly seen: number;
  readonly added: number;
  /** Records the wiki lists with no text; not Comm-Links to show. */
  readonly skipped: number;
}

/**
 * The archive, from the wiki's list pages (ADR-027): every Comm-Link not yet on record becomes
 * an item with the wiki's text and time, newest first, until `pages` pages are read or the
 * list ends. One request per thirty Comm-Links (the list pages by `page[number]`; a bare `page`
 * is ignored), two seconds apart; the hub is not touched.
 */
export async function backfillCommLinks(
  client: Client,
  store: Store,
  state: { read(): CommLinkState; write(next: CommLinkState): void },
  now: () => Date,
  pages: number,
): Promise<BackfillSummary> {
  const known = state.read();
  let seen = 0;
  let read = 0;
  let skipped = 0;
  const before = store.added;
  for (let page = 1; page <= pages; page += 1) {
    const list = WikiCommLinkList.parse(
      await client.json(`${WIKI_API}/comm-links?page%5Bnumber%5D=${page}`),
    );
    read += 1;
    for (const record of list.data) {
      seen += 1;
      const id = String(record.id);
      if (known[id]?.wiki === true) continue;
      const translations = record.translations;
      if (translations === null || translations.en_EN.trim() === "") {
        skipped += 1;
        continue;
      }
      const at = now();
      store.put(
        fromWiki(
          { data: { ...record, translations } },
          entryFromRecord(record),
        ),
        at.toISOString(),
      );
      known[id] = {
        wiki: true,
        first_seen: known[id]?.first_seen ?? at.toISOString(),
      };
    }
    if (list.meta.current_page >= list.meta.last_page) break;
  }
  state.write(known);
  return { pages: read, seen, added: store.added - before, skipped };
}
