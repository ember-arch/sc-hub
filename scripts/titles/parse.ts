/**
 * Reads the Star Citizen Wiki's "Titles" article (starcitizen.tools/Titles, rendered HTML) into
 * titles (ADR-017). Pure: no network, no files, so the unit tests run it on a trimmed committed
 * copy. Every section, table header and cell shape it accepts is listed here; anything else throws
 * `TitlesShapeError` and nothing is written (CLAUDE.md section 5).
 *
 * Names, groups, pledge totals, recruit counts and sessions are plain facts from the columns. The
 * "earned by" sentences, section paragraphs and reward blurbs are the wiki's own text, kept
 * verbatim as runs, under CC BY-SA 4.0.
 */

import type {
  Title,
  TitleGroup,
  TitleGroupText,
  TitleIcon,
  TitleSourceLink,
  WikiText,
} from "schema";
import {
  type Cell,
  TitlesShapeError,
  attributes,
  plainText,
  runsText,
  tableRows,
  takeFootnotes,
  toRuns,
} from "./html.js";

export const ARTICLE_URL = "https://starcitizen.tools/Titles";
export const MEDIA_ORIGIN = "https://media.starcitizen.tools/";

type TableKind =
  | "backer"
  | "recruitment"
  | "recruitment_bonus"
  | "guide"
  | "guide_special"
  | "event"
  | "held";

/** The article's sections in order, by heading id, and the tables each holds. */
export const SECTIONS: readonly {
  readonly id: string;
  readonly group: TitleGroup | null;
  readonly tables: readonly TableKind[];
}[] = [
  { id: "Backer_titles", group: "backer", tables: ["backer"] },
  {
    id: "Recruitment_titles",
    group: "recruitment",
    tables: ["recruitment", "recruitment_bonus"],
  },
  { id: "Guide_titles", group: "guide", tables: ["guide", "guide_special"] },
  { id: "Minigame_titles", group: "minigame", tables: ["event"] },
  { id: "Arena_Commander_titles", group: "arena_commander", tables: ["event"] },
  {
    id: "Persistent_Universe_Gameplay_titles",
    group: "persistent_universe",
    tables: ["event"],
  },
  { id: "Website_event_titles", group: "website_event", tables: ["event"] },
  { id: "Other_titles", group: "other", tables: ["event"] },
  { id: "Unique_titles", group: "unique", tables: ["held"] },
  { id: "Official_titles", group: "official", tables: ["held"] },
  { id: "References", group: null, tables: [] },
];

/** Header rows, as plain text, that identify each table. The guide grid is checked by pattern. */
const HEADERS: Readonly<
  Record<Exclude<TableKind, "guide">, readonly string[]>
> = {
  backer: [
    "Title",
    "Icon",
    "Pledge total",
    "Originally associated with the package(s)",
  ],
  recruitment: ["Title", "Icon", "Recruits", "Additional reward"],
  recruitment_bonus: [
    "Bonus titles",
    "Icon",
    "Recruitment Period",
    "Additional reward",
  ],
  guide_special: ["Special titles", "Icon", "Earned by"],
  event: ["Title", "Icon", "Earnable?", "Earned by"],
  held: ["Title", "Icon", "Title held by"],
};

/**
 * What the article says about a whole group. Each sentence decides its rows' `earnable`, so the
 * run stops if the wiki rewords it and the rule has to be read again.
 */
export const GROUP_RULES = {
  backer: "All backer titles can still be earned.",
  recruitment:
    'All recruitment titles except for "bonus" titles can still be earned.',
  guide: "All guide titles except for the flames can still be earned.",
} as const;

export interface ParsedArticle {
  readonly revisionId: number;
  readonly editedAt: string;
  readonly lead: WikiText[];
  readonly groups: TitleGroupText[];
  readonly titles: Title[];
}

export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug === "") {
    throw new TitlesShapeError(`no slug can be made from "${text}"`);
  }
  return slug;
}

const groupPrefix = (group: TitleGroup): string => group.replace(/_/g, "-");

interface Reference {
  readonly id: string;
  readonly link: TitleSourceLink | null;
}

/** The article's numbered references: the first link out in each, if any. */
export function parseReferences(html: string): Map<string, Reference> {
  const out = new Map<string, Reference>();
  for (const m of html.matchAll(
    /<li id="(cite_note-[^"]+)">([\s\S]*?)<\/li>/g,
  )) {
    const [, id, body] = m;
    if (id === undefined || body === undefined) continue;
    let link: TitleSourceLink | null = null;
    for (const a of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      const at = attributes(a[1] ?? "");
      const href = at["href"] ?? "";
      if (
        (at["class"] ?? "").split(/\s+/).includes("external") &&
        /^https?:\/\//.test(href)
      ) {
        const label = plainText(a[2] ?? "");
        link = { label: label === "" ? href : label, url: href };
        break;
      }
    }
    out.set(id, { id, link });
  }
  return out;
}

function sourcesFor(
  notes: readonly string[],
  references: Map<string, Reference>,
  where: string,
): TitleSourceLink[] {
  const out: TitleSourceLink[] = [];
  for (const note of notes) {
    const ref = references.get(note);
    if (ref === undefined) {
      throw new TitlesShapeError("footnote with no reference", { note, where });
    }
    if (ref.link !== null && !out.some((s) => s.url === ref.link?.url)) {
      out.push(ref.link);
    }
  }
  return out;
}

/** The one image in an icon cell, or null for an empty cell. */
export function iconOf(cell: Cell, where: string): TitleIcon | null {
  const html = cell.html;
  const descriptions = [
    ...html.matchAll(/<a\b([^>]*class="mw-file-description"[^>]*)>/g),
  ];
  if (descriptions.length === 0) {
    if (plainText(html) === "" && !/<img\b/.test(html)) return null;
    throw new TitlesShapeError("icon cell without a wiki image", {
      where,
      html: html.slice(0, 300),
    });
  }
  if (descriptions.length > 1) {
    throw new TitlesShapeError("more than one image in a cell", { where });
  }
  const page = attributes(descriptions[0]?.[1] ?? "")["href"] ?? "";
  const fileMatch = /^\/File:([^/?#]+)$/.exec(page);
  const img = /<img\b([^>]*class="mw-file-element"[^>]*)>/.exec(html);
  const source = /<a\b([^>]*class="mw-file-source"[^>]*)>/.exec(html);
  if (fileMatch?.[1] === undefined || img === null || source === null) {
    throw new TitlesShapeError("image markup not recognised", {
      where,
      html: html.slice(0, 300),
    });
  }
  const imgAttrs = attributes(img[1] ?? "");
  const width = Number(imgAttrs["data-file-width"]);
  const height = Number(imgAttrs["data-file-height"]);
  const url = (attributes(source[1] ?? "")["href"] ?? "").replace(/\?.*$/, "");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    !url.startsWith(MEDIA_ORIGIN)
  ) {
    throw new TitlesShapeError("image size or address not recognised", {
      where,
      width,
      height,
      url,
    });
  }
  return { file: decodeURIComponent(fileMatch[1]), url, width, height };
}

function headerOf(row: readonly Cell[]): string[] {
  return row.map((cell) => plainText(cell.html));
}

function tableKind(header: readonly string[]): TableKind {
  for (const [kind, expected] of Object.entries(HEADERS) as [
    Exclude<TableKind, "guide">,
    readonly string[],
  ][]) {
    if (
      header.length === expected.length &&
      header.every((h, i) => h === expected[i])
    ) {
      return kind;
    }
  }
  if (
    header[0] === "Sessions" &&
    header.length > 1 &&
    header.slice(1).every((h) => /^\d+ \S/.test(h))
  ) {
    return "guide";
  }
  throw new TitlesShapeError("table header not recognised", { header });
}

const EARNABLE: Readonly<Record<string, "yes" | "no" | "unknown">> = {
  "✔": "yes",
  "❌": "no",
  "?": "unknown",
};

function earnableMark(cell: Cell, where: string): "yes" | "no" | "unknown" {
  const mark = plainText(cell.html).replace(/️/g, "");
  const value = EARNABLE[mark];
  if (value === undefined) {
    throw new TitlesShapeError("earnable mark not recognised", { where, mark });
  }
  return value;
}

/** A cell of wiki text: its runs (null when empty) and the footnotes it cites. */
function textCell(
  cell: Cell,
  references: Map<string, Reference>,
  where: string,
): { runs: WikiText | null; sources: TitleSourceLink[] } {
  const { html, notes } = takeFootnotes(cell.html);
  const runs = toRuns(html);
  return {
    runs: runs.length === 0 ? null : (runs as WikiText),
    sources: sourcesFor(notes, references, where),
  };
}

function nameCell(
  cell: Cell,
  references: Map<string, Reference>,
  where: string,
): { name: string; sources: TitleSourceLink[] } {
  const { html, notes } = takeFootnotes(cell.html);
  const name = plainText(html);
  if (name === "") throw new TitlesShapeError("empty title name", { where });
  return { name, sources: sourcesFor(notes, references, where) };
}

function wholeNumber(cell: Cell, pattern: RegExp, where: string): number {
  const text = plainText(cell.html);
  const m = pattern.exec(text);
  if (m?.[1] === undefined) {
    throw new TitlesShapeError("number not recognised", { where, text });
  }
  return Number(m[1].replace(/,/g, ""));
}

/** `"Lancer"` or `"First Responder", "Early Adopter"`; "None" is an empty list. */
export function packageList(text: string, where: string): string[] {
  if (text === "None") return [];
  if (!/^"[^"]+"(, "[^"]+")*$/.test(text)) {
    throw new TitlesShapeError("package list not recognised", { where, text });
  }
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function rewardCell(
  cell: Cell,
  references: Map<string, Reference>,
  where: string,
): { reward: NonNullable<Title["reward"]>; sources: TitleSourceLink[] } {
  const { html, notes } = takeFootnotes(cell.html);
  const bold = /^\s*<b>([\s\S]*?)<\/b>([\s\S]*)$/.exec(html);
  const name = bold === null ? null : plainText(bold[1] ?? "");
  const runs = toRuns(bold === null ? html : (bold[2] ?? ""));
  if (runs.length === 0) {
    throw new TitlesShapeError("reward with no text", { where });
  }
  return {
    reward: { name: name === "" ? null : name, text: runs as WikiText },
    sources: sourcesFor(notes, references, where),
  };
}

function baseTitle(
  group: TitleGroup,
  slug: string,
  name: string,
  icon: TitleIcon | null,
): Title {
  return {
    slug,
    name,
    group,
    earnable: null,
    requirement: null,
    earned_by: null,
    reward: null,
    packages: null,
    sources: [],
    icon,
  };
}

function expectCells(row: readonly Cell[], count: number, where: string): void {
  if (row.length !== count || row.some((c) => c.tag !== "td")) {
    throw new TitlesShapeError("row does not match its header", {
      where,
      cells: row.length,
      expected: count,
    });
  }
}

function parseTable(
  kind: TableKind,
  group: TitleGroup,
  rows: Cell[][],
  references: Map<string, Reference>,
): Title[] {
  const [header, ...body] = rows;
  if (header === undefined || body.length === 0) {
    throw new TitlesShapeError("table without rows", { group, kind });
  }
  const out: Title[] = [];

  if (kind === "guide") {
    const ranks = headerOf(header)
      .slice(1)
      .map((h) => {
        const m = /^(\d+) (\S.*)$/.exec(h);
        return { sessions: Number(m?.[1]), rank: m?.[2] ?? "" };
      });
    for (const row of body) {
      const where = `guide row ${out.length}`;
      expectCells(row, ranks.length + 1, where);
      const track = plainText(row[0]?.html ?? "");
      if (track === "") throw new TitlesShapeError("guide row without a track");
      for (const [i, rank] of ranks.entries()) {
        const cell = row[i + 1];
        if (cell === undefined) continue;
        const icon = iconOf(cell, `${track} ${rank.rank}`);
        if (icon === null) continue;
        out.push({
          ...baseTitle(
            group,
            `guide-${slugify(track)}-${slugify(rank.rank)}`,
            rank.rank,
            icon,
          ),
          earnable: "yes",
          requirement: {
            kind: "guide_sessions",
            track,
            rank: rank.rank,
            sessions: rank.sessions,
          },
        });
      }
    }
    return out;
  }

  const width = HEADERS[kind].length;
  for (const [index, row] of body.entries()) {
    const where = `${group} ${kind} row ${index}`;
    expectCells(row, width, where);
    const [c0, c1, c2, c3] = row as [Cell, Cell, Cell, Cell | undefined];
    const named = nameCell(c0, references, where);
    const icon = iconOf(c1, where);
    if (icon === null) {
      throw new TitlesShapeError("title row without an icon", { where });
    }
    const slug = `${groupPrefix(group)}-${slugify(named.name)}`;
    const title = baseTitle(group, slug, named.name, icon);

    switch (kind) {
      case "backer": {
        const packagesCell = c3 as Cell;
        out.push({
          ...title,
          earnable: "yes",
          requirement: {
            kind: "pledge_total",
            usd: wholeNumber(c2, /^\$(\d{1,3}(?:,\d{3})+|\d+)$/, where),
          },
          packages: packageList(plainText(packagesCell.html), where),
          sources: named.sources,
        });
        break;
      }
      case "recruitment": {
        const reward = rewardCell(c3 as Cell, references, where);
        out.push({
          ...title,
          earnable: "yes",
          requirement: {
            kind: "recruits",
            count: wholeNumber(c2, /^(\d{1,3}(?:,\d{3})+|\d+)$/, where),
          },
          reward: reward.reward,
          sources: [...named.sources, ...reward.sources],
        });
        break;
      }
      case "recruitment_bonus": {
        const period = textCell(c2, references, where);
        const reward = textCell(c3 as Cell, references, where);
        if (period.runs === null || reward.runs === null) {
          throw new TitlesShapeError("bonus row without a period or reward", {
            where,
          });
        }
        out.push({
          ...title,
          earnable: "no",
          requirement: {
            kind: "recruitment_period",
            period: runsText(period.runs),
          },
          reward: { name: null, text: reward.runs },
          sources: dedupe([
            ...named.sources,
            ...period.sources,
            ...reward.sources,
          ]),
        });
        break;
      }
      case "guide_special": {
        if (!/\bFlame$/.test(named.name)) {
          // GROUP_RULES.guide retires "the flames"; any other special title needs reading again.
          throw new TitlesShapeError(
            "special guide title that is not a flame",
            {
              where,
              name: named.name,
            },
          );
        }
        const text = textCell(c2, references, where);
        out.push({
          ...title,
          earnable: "no",
          earned_by: text.runs,
          sources: dedupe([...named.sources, ...text.sources]),
        });
        break;
      }
      case "event": {
        const text = textCell(c3 as Cell, references, where);
        out.push({
          ...title,
          earnable: earnableMark(c2, where),
          earned_by: text.runs,
          sources: dedupe([...named.sources, ...text.sources]),
        });
        break;
      }
      case "held": {
        const text = textCell(c2, references, where);
        out.push({
          ...title,
          earned_by: text.runs,
          sources: dedupe([...named.sources, ...text.sources]),
        });
        break;
      }
    }
  }
  return out;
}

function dedupe(links: readonly TitleSourceLink[]): TitleSourceLink[] {
  const out: TitleSourceLink[] = [];
  for (const link of links) {
    if (!out.some((l) => l.url === link.url)) out.push(link);
  }
  return out;
}

/** Paragraph blocks and wikitables in a section, in order. Anything else is an unknown shape. */
function sectionBlocks(
  chunk: string,
  where: string,
): ({ kind: "p"; html: string } | { kind: "table"; html: string })[] {
  const blocks: (
    { kind: "p"; html: string } | { kind: "table"; html: string }
  )[] = [];
  const rest = chunk
    .replace(/<span class="mw-editsection">[\s\S]*?<\/a>\s*<\/span>/g, "")
    .replace(
      /<p>([\s\S]*?)<\/p>|<table class="wikitable">([\s\S]*?)<\/table>/g,
      (_m, p: string | undefined, table: string | undefined) => {
        if (p !== undefined) blocks.push({ kind: "p", html: p });
        else if (table !== undefined)
          blocks.push({ kind: "table", html: table });
        return "";
      },
    )
    .replace(/<meta\b[^>]*>/g, "");
  if (/<(table|ul|ol|dl|h[3-6]|blockquote|pre|figure|img|p)\b/i.test(rest)) {
    throw new TitlesShapeError(
      "section holds a block this parser does not know",
      {
        where,
        html: rest.slice(0, 300),
      },
    );
  }
  const leftover = plainText(rest);
  if (leftover !== "") {
    throw new TitlesShapeError(
      "section holds text outside paragraphs and tables",
      {
        where,
        text: leftover.slice(0, 200),
      },
    );
  }
  return blocks;
}

function paragraph(html: string): WikiText | null {
  const runs = toRuns(takeFootnotes(html).html);
  return runs.length === 0 ? null : (runs as WikiText);
}

/** The article's titles, groups and opening paragraphs. Throws `TitlesShapeError` on anything unknown. */
export function parseTitlesArticle(html: string): ParsedArticle {
  const revision = /"wgRevisionId":(\d+)/.exec(html);
  const edited =
    /<time id="citizen-page-aside-lastmod-time" datetime="([^"]+)"/.exec(html);
  if (revision?.[1] === undefined || edited?.[1] === undefined) {
    throw new TitlesShapeError("revision id or edit time not found");
  }
  const bodyStart = html.indexOf('class="mw-content-ltr mw-parser-output"');
  if (bodyStart < 0) throw new TitlesShapeError("article body not found");
  const body = html.slice(bodyStart);

  const headings = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(
    (m) => ({
      id: m[1] ?? "",
      text: plainText(m[2] ?? ""),
      start: body.lastIndexOf("<div", m.index),
      end: m.index + m[0].length,
    }),
  );
  const ids = headings.map((h) => h.id);
  if (
    ids.length !== SECTIONS.length ||
    ids.some((id, i) => id !== SECTIONS[i]?.id)
  ) {
    throw new TitlesShapeError("article sections changed", {
      expected: SECTIONS.map((s) => s.id),
      found: ids,
    });
  }
  const references = parseReferences(body);

  const leadChunk = body.slice(body.indexOf(">") + 1, headings[0]?.start);
  const lead = sectionBlocks(leadChunk, "lead").map((block) => {
    if (block.kind !== "p") throw new TitlesShapeError("table in the lead");
    return paragraph(block.html);
  });

  const groups: TitleGroupText[] = [];
  const titles: Title[] = [];
  for (const [i, section] of SECTIONS.entries()) {
    const heading = headings[i];
    if (section.group === null || heading === undefined) continue;
    const chunk = body.slice(heading.end, headings[i + 1]?.start);
    const blocks = sectionBlocks(chunk, section.id);
    const intro: WikiText[] = [];
    const tables: string[] = [];
    for (const block of blocks) {
      if (block.kind === "table") {
        tables.push(block.html);
        continue;
      }
      const p = paragraph(block.html);
      if (p === null) continue;
      if (tables.length > 0) {
        throw new TitlesShapeError("paragraph after a table", {
          section: section.id,
        });
      }
      intro.push(p);
    }
    const introText = intro.map(runsText).join(" ");
    const rule = GROUP_RULES[section.group as keyof typeof GROUP_RULES] as
      string | undefined;
    if (rule !== undefined && !introText.includes(rule)) {
      throw new TitlesShapeError("a group's earnable rule changed", {
        section: section.id,
        expected: rule,
      });
    }
    if (tables.length !== section.tables.length) {
      throw new TitlesShapeError("section has a different number of tables", {
        section: section.id,
        expected: section.tables.length,
        found: tables.length,
      });
    }
    for (const [t, tableHtml] of tables.entries()) {
      const rows = tableRows(tableHtml);
      const kind = tableKind(headerOf(rows[0] ?? []));
      if (kind !== section.tables[t]) {
        throw new TitlesShapeError("table is not the one expected here", {
          section: section.id,
          expected: section.tables[t],
          found: kind,
        });
      }
      titles.push(...parseTable(kind, section.group, rows, references));
    }
    groups.push({ group: section.group, heading: heading.text, intro });
  }

  return {
    revisionId: Number(revision[1]),
    editedAt: edited[1],
    lead: lead.filter((p): p is WikiText => p !== null),
    groups,
    titles,
  };
}
