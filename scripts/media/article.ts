/**
 * Splits a Comm-Link's plain text (as the Star Citizen Wiki API serves it) into the chapters a
 * showcase page shows (ADR-010). The article marks a chapter with an all-caps heading line, often
 * preceded by the file names of its images; a short line after the heading is its kicker; the
 * paragraphs follow until the next heading. Text is returned verbatim, never rewritten.
 */

export interface ArticleChapter {
  readonly heading: string;
  readonly kicker: string | null;
  readonly text: readonly string[];
}

/** A token that names a file or an id rather than words: has an underscore, or is a uuid. */
const isFileToken = (token: string): boolean =>
  token.includes("_") || /^[0-9a-f]{8}-[0-9a-f-]{20,}$/.test(token);

/** A heading line: what is left after file tokens has no lower-case letters and real words. */
export function isHeadingLine(line: string): boolean {
  const words = line.split(/\s+/).filter((t) => !isFileToken(t));
  const rest = words.join(" ");
  return rest.length >= 4 && !/[a-z]/.test(rest) && /[A-Z]{3}/.test(rest);
}

const isJunk = (line: string): boolean =>
  line.split(/\s+/).every((t) => isFileToken(t) || /^[A-Z0-9-]+$/.test(t)) &&
  !isHeadingLine(line);

export function parseArticle(
  text: string,
  headings: readonly string[],
  maxParagraphs = 4,
): ArticleChapter[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const chapters: ArticleChapter[] = [];
  for (const heading of headings) {
    const at = lines.findIndex(
      (l) => l === heading || l.endsWith(` ${heading}`),
    );
    if (at < 0) continue;
    let i = at + 1;
    let kicker: string | null = null;
    const next = lines[i];
    if (next !== undefined && next.length <= 60 && !isJunk(next)) {
      kicker = next;
      i += 1;
    }
    const paragraphs: string[] = [];
    for (; i < lines.length && paragraphs.length < maxParagraphs; i += 1) {
      const line = lines[i]!;
      if (isHeadingLine(line)) break;
      if (isJunk(line) || line.length < 40) continue;
      paragraphs.push(line);
    }
    chapters.push({ heading, kicker, text: paragraphs });
  }
  return chapters;
}

/** "THE ALL-KILLING EYE" → "The all-killing eye" (CLAUDE.md section 7: sentence case). */
export function sentenceCase(heading: string): string {
  const lower = heading.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
