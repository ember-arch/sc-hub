/**
 * Just enough HTML reading for one MediaWiki article (ADR-017). The wiki renders tables, links and
 * images in a fixed, machine-generated form; anything this module does not recognise throws
 * `TitlesShapeError`, so a change on the wiki's side stops the run instead of producing a guess
 * (CLAUDE.md section 5, "Imports halt on unknown shapes").
 */

import type { WikiTextRun } from "schema";

export class TitlesShapeError extends Error {
  readonly detail: Record<string, unknown>;

  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "TitlesShapeError";
    this.detail = detail;
  }
}

const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
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
      if (named === undefined) {
        throw new TitlesShapeError(`unknown HTML entity ${match}`);
      }
      return named;
    },
  );
}

/** The attributes of one opening tag. MediaWiki always double-quotes them. */
export function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)) {
    const [, name, value] = m;
    if (name !== undefined && value !== undefined) {
      out[name] = decodeEntities(value);
    }
  }
  return out;
}

/** The only tags wiki text may hold here: links, bold, italics, line and paragraph breaks. */
const TEXT_TAGS = new Set(["a", "b", "i", "br", "p", "span"]);

/**
 * Checks a cell of text holds only known inline markup. Anything else (a `<style>`, a struck-out
 * `<s>`, a hidden or styled span) could put text on the page the wiki does not show, so it stops
 * the run. Footnote markers must be taken out first.
 */
export function assertTextTags(html: string, where: string): void {
  const body = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
    const [whole, closing, rawTag, attrText = ""] = m;
    const tag = (rawTag ?? "").toLowerCase();
    const attrs = attrText.replace(/\/\s*$/, "").trim();
    const unknown =
      !TEXT_TAGS.has(tag) ||
      (closing === "" && tag === "span" && attrs !== "") ||
      /\bstyle=/i.test(attrs);
    if (unknown) {
      throw new TitlesShapeError("markup this parser does not know in text", {
        where,
        tag: whole,
      });
    }
  }
}

/** Collapses whitespace (`\s` includes no-break spaces and newlines) to single spaces. */
export function squash(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Text with every tag removed and entities decoded; `<br>` becomes a space. */
export function plainText(html: string): string {
  return squash(
    decodeEntities(
      html
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, ""),
    ),
  ).trim();
}

const FOOTNOTE =
  /<sup\b[^>]*class="reference"[^>]*>\s*<a href="#([^"]+)"[^>]*>[\s\S]*?<\/a>\s*<\/sup>/g;

/** Removes footnote markers, returning the note ids they pointed at, in order. */
export function takeFootnotes(html: string): { html: string; notes: string[] } {
  const notes: string[] = [];
  const out = html.replace(FOOTNOTE, (_match, id: string) => {
    notes.push(decodeURIComponent(id));
    return "";
  });
  if (/<sup\b/i.test(out)) {
    throw new TitlesShapeError("superscript that is not a footnote", {
      html: out.slice(0, 300),
    });
  }
  return { html: out, notes };
}

const isExternal = (a: Record<string, string>): boolean =>
  (a["class"] ?? "").split(/\s+/).includes("external") &&
  /^https?:\/\//.test(a["href"] ?? "");

/**
 * Wiki text as runs, verbatim: links out to other sites keep their address, links to other wiki
 * pages become plain text, and formatting (bold, italics) is dropped. Images and footnote markers
 * must already be gone; any image left over is an unknown shape.
 */
export function toRuns(html: string, where = "text"): WikiTextRun[] {
  assertTextTags(html, where);
  const raw: WikiTextRun[] = [];
  let last = 0;
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const [whole, attrText, inner] = m;
    if (whole === undefined || attrText === undefined || inner === undefined)
      continue;
    const start = m.index;
    raw.push({ text: textKeepingEdges(html.slice(last, start)), href: null });
    const a = attributes(attrText);
    raw.push({
      text: textKeepingEdges(inner),
      href: isExternal(a) ? (a["href"] ?? null) : null,
    });
    last = start + whole.length;
  }
  raw.push({ text: textKeepingEdges(html.slice(last)), href: null });

  // A link never carries its neighbours' spaces: move them into plain runs beside it.
  const spaced: WikiTextRun[] = raw.flatMap((run) => {
    if (run.href === null) return [run];
    const text = run.text.trim();
    if (text === "") return [{ text: run.text, href: null }];
    return [
      { text: run.text.startsWith(" ") ? " " : "", href: null },
      { text, href: run.href },
      { text: run.text.endsWith(" ") ? " " : "", href: null },
    ];
  });
  // Merge neighbouring plain runs, collapse doubled spaces at the joins, trim both ends.
  const merged: WikiTextRun[] = [];
  for (const run of spaced) {
    const prev = merged.at(-1);
    if (prev !== undefined && prev.href === null && run.href === null) {
      merged[merged.length - 1] = {
        text: squash(prev.text + run.text),
        href: null,
      };
    } else {
      merged.push({ text: squash(run.text), href: run.href });
    }
  }
  const first = merged[0];
  if (first !== undefined && first.href === null) {
    merged[0] = { text: first.text.trimStart(), href: null };
  }
  const end = merged.at(-1);
  if (end !== undefined && end.href === null) {
    merged[merged.length - 1] = { text: end.text.trimEnd(), href: null };
  }
  return merged.filter((run) => run.text !== "");
}

/** Text with tags removed and entities decoded, keeping a leading or trailing space. */
function textKeepingEdges(html: string): string {
  return squash(
    decodeEntities(
      html
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p>\s*<p>/gi, " ")
        .replace(/<[^>]+>/g, ""),
    ),
  );
}

/** The runs' text joined, for checks and search. */
export function runsText(runs: readonly WikiTextRun[]): string {
  return runs.map((r) => r.text).join("");
}

export interface Cell {
  readonly tag: "th" | "td";
  readonly html: string;
}

/** The rows of one table, each as its cells. Spanning cells are an unknown shape. */
export function tableRows(tableHtml: string): Cell[][] {
  if (/<table\b/i.test(tableHtml)) {
    throw new TitlesShapeError("table inside a table");
  }
  const rows: Cell[][] = [];
  for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells: Cell[] = [];
    for (const cell of (row[1] ?? "").matchAll(
      /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/g,
    )) {
      const [, tag, attrText, inner] = cell;
      if (/\b(rowspan|colspan)=/.test(attrText ?? "")) {
        throw new TitlesShapeError("table cell spans rows or columns", {
          attributes: attrText,
        });
      }
      cells.push({ tag: tag as "th" | "td", html: inner ?? "" });
    }
    rows.push(cells);
  }
  return rows;
}
