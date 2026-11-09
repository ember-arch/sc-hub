/**
 * Cuts the fetched article down to the committed copy the parser's unit tests read: the revision
 * id, the edit time, the article body (every section, paragraph and table row, so the tests can
 * check the whole catalogue against its source) and the references the rows cite. The skin's
 * navigation, scripts and styles are left out. `rowsPerTable` trims tables further when needed.
 */

import { TitlesShapeError } from "./html.js";

export function trimArticle(
  html: string,
  rowsPerTable = Number.POSITIVE_INFINITY,
): string {
  const revision = /"wgRevisionId":\d+/.exec(html)?.[0];
  const time =
    /<time id="citizen-page-aside-lastmod-time" datetime="[^"]+">/.exec(
      html,
    )?.[0];
  const open = /<div class="mw-content-ltr mw-parser-output"[^>]*>/.exec(html);
  const refsEnd = html.indexOf("</ol>", html.indexOf('class="references"'));
  if (
    revision === undefined ||
    time === undefined ||
    open === null ||
    refsEnd < 0
  ) {
    throw new TitlesShapeError("article landmarks not found for the sample");
  }
  let body = html.slice(open.index, refsEnd + "</ol>".length);

  body = body.replace(
    /(<table class="wikitable">)([\s\S]*?)(<\/table>)/g,
    (_m, start: string, inner: string, end: string) => {
      const rows = [...inner.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(
        (r) => r[0],
      );
      return `${start}\n<tbody>${rows.slice(0, rowsPerTable + 1).join("\n")}</tbody>${end}`;
    },
  );

  const refsStart = body.indexOf('<ol class="references">');
  const kept = body.slice(0, refsStart < 0 ? body.length : refsStart);
  const cited = new Set(
    [...kept.matchAll(/href="#(cite_note-[^"]+)"/g)].map((m) => m[1]),
  );
  body = body.replace(
    /<li id="(cite_note-[^"]+)">[\s\S]*?<\/li>\n?/g,
    (li, id: string) => (cited.has(id) ? li : ""),
  );

  return [
    "<!doctype html>",
    "<!-- Trimmed copy of https://starcitizen.tools/Titles for unit tests (ADR-017).",
    "     Text: Star Citizen Wiki contributors, CC BY-SA 4.0. Written by scripts/titles/fetch.ts; do not edit by hand. -->",
    `<html><head><script>RLCONF={${revision}};</script></head><body>`,
    `${time}</time>`,
    body,
    "</div></body></html>",
    "",
  ].join("\n");
}
