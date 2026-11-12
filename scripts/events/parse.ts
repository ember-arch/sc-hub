/**
 * Reading an event's schedule from RSI's own page (ADR-057). A Comm-Link made with RSI's page
 * builder is an app shell whose HTML names, in an entity-encoded JSON, the address of its body
 * (`content.htmlUrl`, under `/alexandria/html/`); the body is server-made component markup:
 * a `<g-banner-advanced>` with the picture, then a `<g-features>` whose `<template slot>`s hold a
 * day's title ("Roberts Space Industries"), its subtitle ("Day 1, November 13-14") and its
 * introduction as plain HTML, the ships a list of links to RSI's pledge pages. A run of entries
 * can also sit as `<g-feature>` children of one `<g-features>`, whose own slots are then
 * placeholders. Anything this module does not recognise throws `EventShapeError`, so a change on
 * RSI's side stops the run instead of producing a guess (CLAUDE.md section 5).
 */

export class EventShapeError extends Error {
  readonly detail: Record<string, unknown>;

  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "EventShapeError";
    this.detail = detail;
  }
}

const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      const named = NAMED[code.toLowerCase()];
      if (named === undefined)
        throw new EventShapeError(`unknown HTML entity ${match}`);
      return named;
    },
  );
}

/** Text of an HTML fragment: tags out, entities decoded, white space (no-break spaces too) folded. */
export function plainText(html: string): string {
  return decodeEntities(
    html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""),
  )
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The zero-width space RSI's editor leaves in its text; the no-break space is white space already. */
const ZERO_WIDTH = new RegExp(String.fromCharCode(0x200b), "g");

/**
 * The first sentence of RSI's text, for a brief quote (CLAUDE.md: CIG text only briefly, with
 * attribution): cut at the first full stop, question or exclamation mark followed by a capital,
 * and at a word near 240 characters when a sentence runs longer.
 */
export function firstSentence(text: string, max = 240): string {
  const m = /^(.+?[.!?])(?=\s+[A-Z“"‘'(])/.exec(text);
  const sentence = (m?.[1] ?? text).trim();
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > max / 2 ? space : max).trimEnd()}…`;
}

/** The attributes of one opening tag; the page builder double-quotes every value. */
export function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(
    /([a-zA-Z_:@][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g,
  )) {
    const [, name, value] = m;
    if (name !== undefined) out[name] = value === undefined ? "" : value;
  }
  return out;
}

/** Parses an attribute holding JSON (the page builder's `:prop` bindings). */
function jsonAttr(
  attrs: Record<string, string>,
  name: string,
  where: string,
): unknown {
  const raw = attrs[name];
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(decodeEntities(raw));
  } catch {
    throw new EventShapeError(`${where}: ${name} is not JSON`);
  }
}

const RSI_ORIGIN = "https://robertsspaceindustries.com";

/**
 * The address of a page-builder Comm-Link's body, from the transmission page's HTML: exactly one
 * `htmlUrl` under RSI's `/alexandria/html/`, or the page is not one this module reads.
 */
export function bodyUrlOf(pageHtml: string): string {
  const decoded = pageHtml.replace(/&quot;/g, '"');
  const found = new Set<string>();
  for (const m of decoded.matchAll(/"htmlUrl":"([^"]+)"/g)) {
    found.add((m[1] ?? "").replace(/\\\//g, "/"));
  }
  if (found.size !== 1) {
    throw new EventShapeError(
      `the transmission page names ${found.size} body addresses, not one`,
      { found: [...found] },
    );
  }
  const [url] = [...found];
  let parsed: URL;
  try {
    parsed = new URL(url!);
  } catch {
    throw new EventShapeError("the body address is not a URL", { url });
  }
  if (
    parsed.origin !== RSI_ORIGIN ||
    !parsed.pathname.startsWith("/alexandria/html/")
  ) {
    throw new EventShapeError("the body address is not RSI's page builder", {
      url,
    });
  }
  return parsed.toString();
}

/** A picture as the page builder binds it: its full WebP (or original) and its alt text. */
export interface BodyPicture {
  readonly url: string;
  readonly alt: string;
}

function pictureOf(value: unknown, where: string): BodyPicture | null {
  if (value === null || value === undefined) return null;
  const v = value as {
    webp?: { max?: unknown };
    originalFormat?: { max?: unknown };
    alt?: unknown;
  };
  const path = v.webp?.max ?? v.originalFormat?.max;
  if (path === undefined) return null;
  if (typeof path !== "string" || !path.startsWith("/i/")) {
    throw new EventShapeError(`${where}: a picture address not under /i/`, {
      path,
    });
  }
  return {
    url: `${RSI_ORIGIN}${path}`,
    alt: typeof v.alt === "string" ? v.alt.trim() : "",
  };
}

/** One entry of the body: a day, a run of days, or another section (a welcome note). */
export interface BodyEntry {
  readonly title: string;
  readonly subtitle: string | null;
  /** The entry's HTML: a day's introduction and ship list, or a short body. */
  readonly html: string;
  /** The picture shown with it: the banner before it, or the entry's own. */
  readonly picture: BodyPicture | null;
}

export interface ScheduleBody {
  /** The opening banner's title and subtitle: "Intergalactic Aerospace Expo 2956". */
  readonly title: string;
  readonly subtitle: string | null;
  /** The opening banner's picture: the show's key art. */
  readonly picture: BodyPicture | null;
  /** The introduction's paragraphs, as HTML. */
  readonly intro: readonly string[];
  readonly entries: readonly BodyEntry[];
}

/** The `<template slot>`s directly inside a component, by slot name. */
function slotsOf(inner: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of inner.matchAll(
    /<template slot="([a-z-]+)">([\s\S]*?)<\/template>/g,
  )) {
    const [, slot, html] = m;
    if (slot !== undefined && html !== undefined && !out.has(slot))
      out.set(slot, html);
  }
  return out;
}

/** The index of the `>` that ends an opening tag whose attributes start at `from`, or -1. */
function openingTagEnd(html: string, from: number): number {
  let quoted = false;
  for (let i = from; i < html.length; i += 1) {
    const c = html[i];
    if (c === '"') quoted = !quoted;
    else if (c === ">" && !quoted) return i;
  }
  return -1;
}

const COMPONENTS = new Set([
  "g-banner-advanced",
  "g-introduction",
  "g-features",
  "g-feature",
]);

/** Reads the page builder's body into its banner, introduction and entries. */
export function parseScheduleBody(html: string): ScheduleBody {
  let title: string | null = null;
  let subtitle: string | null = null;
  let keyArt: BodyPicture | null = null;
  const intro: string[] = [];
  const entries: BodyEntry[] = [];
  // The banner most recently seen: the picture of the next entry.
  let banner: BodyPicture | null = null;

  const open = /<(g-[a-z-]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(html)) !== null) {
    const [, tag = ""] = m;
    // The opening tag runs to the first `>` outside a quoted value: the builder's JSON bindings
    // carry raw markup ("<p>…</p>") inside their quotes.
    const tagEnd = openingTagEnd(html, m.index + m[0].length);
    if (tagEnd < 0) {
      throw new EventShapeError(`<${tag}> at ${m.index} never ends`);
    }
    const whole = html.slice(m.index, tagEnd + 1);
    const attrText = html.slice(m.index + m[0].length, tagEnd);
    if (!COMPONENTS.has(tag)) {
      throw new EventShapeError(`an unknown component <${tag}>`, {
        at: m.index,
      });
    }
    const attrs = attributes(attrText);
    const where = `<${tag}> at ${m.index}`;
    if (tag === "g-banner-advanced") {
      const media = jsonAttr(attrs, ":media", where) as
        { background?: { picture?: unknown } } | undefined;
      const picture = pictureOf(media?.background?.picture, where);
      const content = jsonAttr(attrs, ":content", where) as
        { text?: { title?: unknown; subtitle?: unknown } } | undefined;
      const t = content?.text?.title;
      if (title === null && typeof t === "string" && t.trim() !== "") {
        title = plainText(t);
        const s = content?.text?.subtitle;
        subtitle =
          typeof s === "string" && s.trim() !== "" ? plainText(s) : null;
        keyArt = picture;
      } else {
        banner = picture;
      }
      continue;
    }
    if (tag === "g-introduction") {
      const info = jsonAttr(attrs, ":info", where) as
        { contents?: unknown } | undefined;
      const contents = info?.contents;
      if (!Array.isArray(contents)) {
        throw new EventShapeError(`${where}: no contents`);
      }
      for (const c of contents) {
        if (typeof c !== "string")
          throw new EventShapeError(`${where}: a content that is not HTML`);
        for (const p of c.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
          if (plainText(p[1] ?? "") !== "") intro.push(p[1] ?? "");
        }
      }
      continue;
    }
    // A <g-features> or <g-feature>: its inner HTML up to its own closing tag.
    const close = `</${tag}>`;
    const start = m.index + whole.length;
    const end = html.indexOf(close, start);
    if (end < 0) throw new EventShapeError(`${where}: never closed`);
    const inner = html.slice(start, end);
    if (tag === "g-features" && inner.includes("<g-feature ")) {
      // A container: its entries are its <g-feature> children, read as the scan reaches them;
      // its own slots are the builder's placeholders and are not shown.
      continue;
    }
    const slots = slotsOf(inner);
    const entryTitle = slots.get("title");
    if (entryTitle === undefined) {
      throw new EventShapeError(`${where}: an entry with no title`);
    }
    const ownPicture =
      tag === "g-feature"
        ? pictureOf(jsonAttr(attrs, ":picture", where), where)
        : null;
    const sub = slots.get("subtitle");
    entries.push({
      title: plainText(entryTitle),
      subtitle:
        sub === undefined || plainText(sub) === "" ? null : plainText(sub),
      html: slots.get("introduction") ?? slots.get("body") ?? "",
      picture: ownPicture ?? (tag === "g-features" ? banner : null),
    });
    if (tag === "g-features") banner = null;
    open.lastIndex = end + close.length;
    continue;
  }
  if (title === null) {
    throw new EventShapeError("the body has no opening banner with a title");
  }
  return { title, subtitle, picture: keyArt, intro, entries };
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** A month's number (1 to 12) from its English name, or null. */
export function monthOf(name: string): number | null {
  const i = MONTHS.indexOf(name.toLowerCase() as (typeof MONTHS)[number]);
  return i < 0 ? null : i + 1;
}

/** A calendar date as RSI writes it, without a year. */
export interface MonthDay {
  readonly month: number;
  readonly day: number;
}

/** A day's label: "Day 1, November 13-14", "Day 10, November 22", "Day 11-15, November 23-27". */
export interface DayLabel {
  readonly first: number;
  readonly last: number;
  readonly from: MonthDay;
  readonly to: MonthDay;
}

/** Reads a subtitle as a day label, or null when it is not one ("Pre-Flight Check" has none). */
export function dayLabel(subtitle: string): DayLabel | null {
  const head = /^Days?\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*,\s*(.+)$/i.exec(subtitle);
  if (head === null) return null;
  const [, a, b, dates = ""] = head;
  const first = Number(a);
  const last = b === undefined ? first : Number(b);
  const d =
    /^([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?$/.exec(
      dates.trim(),
    );
  if (d === null) {
    throw new EventShapeError(`a day label with dates it cannot read`, {
      subtitle,
    });
  }
  const [, m1 = "", d1, m2, d2] = d;
  const from = monthOf(m1);
  const to = m2 === undefined ? from : monthOf(m2);
  if (from === null || to === null || last < first) {
    throw new EventShapeError(`a day label it cannot read`, { subtitle });
  }
  return {
    first,
    last,
    from: { month: from, day: Number(d1) },
    to: { month: to, day: Number(d2 ?? d1) },
  };
}

/** A ship line of a day: `<li><a href><strong>Name</strong></a> - line</li>`. */
export interface BodyShip {
  readonly name: string;
  readonly url: string | null;
  readonly line: string | null;
  readonly group: string | null;
}

/** A day's introduction: its opening sentence, its maker headings and its ships. */
export interface DayBody {
  readonly lead: string | null;
  readonly groups: readonly string[];
  readonly ships: readonly BodyShip[];
}

/** Reads a day's introduction HTML into its lead, the maker headings and the ship lines. */
export function parseDayHtml(html: string, where: string): DayBody {
  let lead: string | null = null;
  const groups: string[] = [];
  const ships: BodyShip[] = [];
  let group: string | null = null;
  const blocks = /<(p|ul|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g;
  let b: RegExpExecArray | null;
  while ((b = blocks.exec(html)) !== null) {
    const [, tag = "", inner = ""] = b;
    if (tag === "ul") {
      for (const li of inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
        const item = li[1] ?? "";
        const strong = /<strong>([\s\S]*?)<\/strong>/.exec(item);
        const href = /<a\b[^>]*\bhref="([^"]+)"/.exec(item);
        const name = plainText(strong?.[1] ?? "");
        if (name === "") {
          throw new EventShapeError(`${where}: a list line with no name`, {
            line: plainText(item).slice(0, 120),
          });
        }
        const text = plainText(item);
        const rest = text.startsWith(name) ? text.slice(name.length) : text;
        const line = rest.replace(/^\s*[-–—:]\s*/, "").trim();
        let url: string | null = null;
        if (href !== null) {
          try {
            url = new URL(decodeEntities(href[1] ?? ""), RSI_ORIGIN).toString();
          } catch {
            throw new EventShapeError(`${where}: a ship link that is no URL`, {
              name,
            });
          }
        }
        ships.push({
          name,
          url,
          line: line === "" ? null : firstSentence(line),
          group,
        });
      }
      continue;
    }
    const text = plainText(inner);
    if (text === "") continue;
    // A paragraph that is one bold run before a list is a maker's heading on a shared day.
    const heading =
      tag.startsWith("h") ||
      /^\s*<strong>[^<]*<\/strong>\s*$/.test(inner.replace(/&nbsp;/g, " "));
    if (heading) {
      group = text;
      groups.push(text);
      continue;
    }
    lead ??= firstSentence(text);
  }
  return { lead, groups, ships };
}
