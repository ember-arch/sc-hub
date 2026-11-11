import type { ContentItem } from "schema";

/**
 * CIG's patch notes as the patch pages show them (ADR-049): the Spectrum posts in the "Patch
 * Notes" channel that the news pack already holds (ADR-027, ADR-037), matched to a build by the
 * version and build number in their titles, and laid out in the sections CIG writes them in.
 * Nothing is reworded or summarised: each line is CIG's, only the layout is recovered, because
 * the pack keeps a post as paragraphs and CIG's headings arrive as short paragraphs of their own.
 */

export interface NoteGroup {
  /** A heading inside a section ("Gameplay Updates", "Bug Fixes"), or null for lines before one. */
  readonly title: string | null;
  readonly items: readonly string[];
}

export interface NoteSection {
  /** CIG's own top-level heading, as written: "Testing/Feedback Focus", "Known Issues", … */
  readonly title: string;
  readonly groups: readonly NoteGroup[];
}

/**
 * What a post is: a PTU wave's notes, a LIVE post on Spectrum, the Hotfix Central thread, the
 * official LIVE notes on RSI's Comm-Link, or the release announcement there.
 */
export type NoteKind = "ptu" | "live" | "hotfix" | "official" | "announcement";

export interface PatchNote {
  readonly id: string;
  readonly kind: NoteKind;
  readonly title: string;
  readonly url: string;
  readonly publishedAt: string;
  /** "4.10.2": the patch the notes are for, three parts always ("4.10" is 4.10.0). */
  readonly version: string;
  readonly channel: "LIVE" | "PTU";
  /** The build number the title gives, when it gives one. */
  readonly build: string | null;
  /** "Wave 1", "All Backers", "Evocati NDA": who could play it, from the title's brackets. */
  readonly audience: string | null;
  readonly releaseCandidate: string | null;
  readonly hotfix: boolean;
  /** Audience, server and persistence lines from the head of the post. */
  readonly facts: readonly { label: string; value: string }[];
  readonly sections: readonly NoteSection[];
  /**
   * True when the pack holds the post as one run of text (posts read before ADR-037 read threads
   * in full); the page then links to the post instead of laying it out.
   */
  readonly flat: boolean;
  readonly summary: string;
}

/** CIG's top-level headings, normalised: "&" and "and" alike, case and spacing ignored. */
const TOP_HEADINGS = [
  "testing/feedback focus",
  "testing focus",
  "feedback focus",
  "known issues",
  "features & updates",
  "new features",
  "feature updates",
  "features",
  "updates",
  "bug fixes & technical",
  "bugfixes & technical",
  "bug fixes",
  "bugfixes",
  "technical",
  "technical updates",
];

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .trim();

const TOP = new Set(TOP_HEADINGS.map(norm));

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** The text of an HTML fragment: tags dropped, the common entities decoded, spaces collapsed. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** The post's paragraphs and list items, in order, as text. */
export function paragraphs(html: string): string[] {
  return blocks(html).map((b) => b.text);
}

/** The post's blocks in order, each with whether it was a list item (never a heading). */
export function blocks(html: string): { text: string; item: boolean }[] {
  const out: { text: string; item: boolean }[] = [];
  const re = /<(p|li|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const t = plainText(m[2] ?? "");
    if (t !== "") out.push({ text: t, item: m[1]?.toLowerCase() === "li" });
  }
  return out;
}

/** "4.10" is 4.10.0; "4.10.2" stays. */
function fullVersion(v: string): string {
  return v.split(".").length === 2 ? `${v}.0` : v;
}

/** What a notes title says: "[Wave 1] Star Citizen Alpha 4.10.2 PTU Patch Notes 12770507". */
export function readTitle(title: string): {
  version: string;
  channel: "LIVE" | "PTU";
  build: string | null;
  audience: string | null;
  releaseCandidate: string | null;
  hotfix: boolean;
} | null {
  const version = /\bAlpha\s+(\d+\.\d+(?:\.\d+)?)/i.exec(title)?.[1];
  if (version === undefined) return null;
  const channel = /\bPTU\b/i.test(title)
    ? "PTU"
    : /\bLIVE\b/i.test(title)
      ? "LIVE"
      : null;
  if (channel === null) return null;
  return {
    version: fullVersion(version),
    channel,
    build: /\b(\d{7,9})\s*$/.exec(title.trim())?.[1] ?? null,
    audience: /^\s*\[([^\]]+)\]/.exec(title)?.[1]?.trim() ?? null,
    releaseCandidate: /\b(RC\d+)\b/i.exec(title)?.[1]?.toUpperCase() ?? null,
    hotfix: /\bhotfix\b/i.test(title),
  };
}

const FACT =
  /^(Audience|Server Info|Long Term Persistence|Starting aUEC|Pledge Copy|Database Reset|Status|Latest LIVE Client CL|Latest LIVE DGS CL)\s*:\s*(.+)$/i;

/** Headings CIG uses inside its fix lists; anything else short there is a fix of its own. */
const FIX_HEADINGS = new Set(
  [
    "bug fixes",
    "bugfixes",
    "technical",
    "technical updates",
    "client crashes fixed",
    "server crashes fixed",
    "known issues",
  ].map(norm),
);

const isFixSection = (title: string): boolean =>
  /bug ?fix|technical|known issues/i.test(title);

const CRASH_TALLY = /^\d+\s+\w+(\s+\w+)?\s+crash(es)?\s+fixed$/i;

/** A Hotfix Central entry: "► 10.14.2026: DGS Hotfix 12939222 - Canaried onto multiple shards". */
const HOTFIX_ENTRY = /^►\s*(.+)$/;

/** A line that reads as a heading inside a section: short, no sentence end, not a fix line. */
function looksLikeHeading(line: string, next: string | undefined): boolean {
  if (line.length > 48) return false;
  if (/[.:;!?,)]$/.test(line)) return false;
  if (/^(potential fix|fixed|fix|known issue|note)\b/i.test(line)) return false;
  // A crash tally ("2 Client Crashes Fixed") opens the fixes of its kind.
  if (CRASH_TALLY.test(line)) return true;
  // A heading is followed by something to head.
  return next !== undefined && next !== "";
}

/** CIG's sections, recovered from the paragraphs. */
export function noteSections(
  lines: readonly string[],
  /** Which lines were list items in the post; a list item is never a heading. */
  listItems: ReadonlySet<number> = new Set(),
): {
  facts: { label: string; value: string }[];
  sections: NoteSection[];
} {
  const facts: { label: string; value: string }[] = [];
  const sections: {
    title: string;
    groups: { title: string | null; items: string[] }[];
  }[] = [];
  let section: (typeof sections)[number] | null = null;
  lines.forEach((line, i) => {
    const fact = FACT.exec(line);
    if (section === null && fact !== null) {
      facts.push({ label: fact[1]!, value: fact[2]!.trim() });
      return;
    }
    if (TOP.has(norm(line))) {
      section = { title: line, groups: [{ title: null, items: [] }] };
      sections.push(section);
      return;
    }
    if (section === null) return; // the opening sentence ("has been released …") and the version line
    const groups = section.groups;
    const next = lines[i + 1];
    // Fix lists use a few set headings; the testing focus is a plain list; features have
    // a heading per feature.
    const heading = listItems.has(i)
      ? false
      : isFixSection(section.title)
        ? FIX_HEADINGS.has(norm(line)) || CRASH_TALLY.test(line)
        : /testing|feedback/i.test(section.title)
          ? false
          : looksLikeHeading(line, next) && !TOP.has(norm(next ?? ""));
    if (heading) {
      groups.push({ title: line, items: [] });
      return;
    }
    // A bare address (the issue council, the status page) is a link, not a line of the notes.
    if (/^https?:\/\/\S+$/.test(line)) return;
    groups[groups.length - 1]!.items.push(line);
  });
  return {
    facts,
    sections: sections.map((s) => ({
      title: s.title,
      groups: s.groups.filter((g) => g.items.length > 0 || g.title !== null),
    })),
  };
}

/** Hotfix Central: the status lines as facts, then one group per dated entry, newest first. */
export function hotfixSections(lines: readonly string[]): {
  facts: { label: string; value: string }[];
  sections: NoteSection[];
} {
  const facts: { label: string; value: string }[] = [];
  const groups: { title: string; items: string[] }[] = [];
  for (const line of lines) {
    const entry = HOTFIX_ENTRY.exec(line);
    if (entry !== null) {
      groups.push({ title: entry[1]!.trim(), items: [] });
      continue;
    }
    const current = groups[groups.length - 1];
    if (current === undefined) {
      const fact = FACT.exec(line);
      if (fact !== null)
        facts.push({ label: fact[1]!, value: fact[2]!.trim() });
      continue;
    }
    // Bare addresses (the issue council, the status page) are links, not lines of the notes.
    if (/^https?:\/\/\S+$/.test(line)) continue;
    current.items.push(line);
  }
  return {
    facts,
    sections: groups.length === 0 ? [] : [{ title: "Hotfixes", groups }],
  };
}

/** The official notes on RSI's Comm-Link ("Star Citizen Alpha 4.10.1", Patch Notes channel). */
function officialHead(
  item: ContentItem,
): { kind: NoteKind; version: string } | null {
  if (item.source === "spectrum") return null;
  const version = /\bAlpha\s+(\d+\.\d+(?:\.\d+)?)\b/i.exec(item.title)?.[1];
  if (version === undefined) return null;
  if (/\/comm-link\/patch-notes\//i.test(item.url))
    return { kind: "official", version: fullVersion(version) };
  if (/\/comm-link\/transmission\//i.test(item.url))
    return { kind: "announcement", version: fullVersion(version) };
  return null;
}

/** The build number a post's opening line gives: "VERSION 4.10.1-LIVE.12650677". */
const VERSION_LINE = /VERSION\s+\d+\.\d+(?:\.\d+)?-(?:LIVE|PTU)\.(\d+)/;

/**
 * Every patch-notes post in the pack, newest first, with the build it is for. A post the pack
 * holds twice (a revision, or a thread read twice) shows once, its latest copy.
 */
export function patchNotes(news: readonly ContentItem[]): PatchNote[] {
  const out = new Map<string, PatchNote>();
  for (const item of news) {
    const official = officialHead(item);
    let note: PatchNote | null = null;
    if (official !== null) {
      note = {
        id: item.id,
        kind: official.kind,
        title: item.title,
        url: item.url,
        publishedAt: item.published_at,
        version: official.version,
        channel: "LIVE",
        build: VERSION_LINE.exec(plainText(item.body_html ?? ""))?.[1] ?? null,
        audience: null,
        releaseCandidate: null,
        hotfix: false,
        facts: [],
        sections: [],
        // RSI's page arrives with its template's filler text woven in: linked, not laid out.
        flat: true,
        summary: item.summary ?? "",
      };
    } else if (
      item.source === "spectrum" &&
      item.forum === "Patch Notes" &&
      !/^re:/i.test(item.title.trim())
    ) {
      const head = readTitle(item.title);
      if (head === null) continue;
      const parts = blocks(item.body_html ?? "");
      const lines = parts.map((b) => b.text);
      const listItems = new Set(parts.flatMap((b, i) => (b.item ? [i] : [])));
      const { facts, sections } = head.hotfix
        ? hotfixSections(lines)
        : noteSections(lines, listItems);
      note = {
        id: item.id,
        kind: head.hotfix ? "hotfix" : head.channel === "PTU" ? "ptu" : "live",
        title: item.title,
        url: item.url,
        publishedAt: item.published_at,
        ...head,
        build:
          head.build ??
          VERSION_LINE.exec(plainText(item.body_html ?? ""))?.[1] ??
          null,
        facts,
        sections,
        flat: lines.length <= 1 || sections.length === 0,
        summary: item.summary ?? plainText(item.body_html ?? "").slice(0, 240),
      };
    }
    if (note === null) continue;
    // RSI titles its release announcement and its notes alike ("Star Citizen Alpha 4.10.1"):
    // the kind keeps both.
    const key = `${item.source}:${note.kind}:${note.title.replace(/\s+/g, " ").trim()}`;
    const seen = out.get(key);
    if (seen === undefined || seen.publishedAt <= note.publishedAt)
      out.set(key, note);
  }
  return [...out.values()].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

/** The posts for a patch: every PTU wave that led to it and the LIVE posts for it, newest first. */
export function notesFor(
  notes: readonly PatchNote[],
  version: string,
  channel?: "LIVE" | "PTU",
): PatchNote[] {
  return notes.filter(
    (n) =>
      n.version === version && (channel === undefined || n.channel === channel),
  );
}

/** Every line of a post, in order, with the section and group it sits in. */
export function noteLines(
  note: PatchNote,
): { section: string; group: string | null; text: string }[] {
  return note.sections.flatMap((s) =>
    s.groups.flatMap((g) =>
      g.items.map((text) => ({ section: s.title, group: g.title, text })),
    ),
  );
}
