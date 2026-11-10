/**
 * Bodies are stored as HTML the site can place as is (spec 03, notes): text is escaped, and
 * HTML from a source is kept to an allowlist of headings, paragraphs, lists, quotes, links and
 * images from the source's domain. No scripts, no iframes, no attributes beyond href, src, alt.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Plain text, paragraphs split on blank lines (and single newlines), as escaped HTML. */
export function paragraphsHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}|\n(?=\s*[-*•])|\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");
}

/** The first paragraph of plain text, for the summary; null when there is none. */
export function firstParagraph(text: string): string | null {
  const first = text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((p) => p.trim())
    .find((p) => p !== "");
  return first === undefined ? null : first;
}

const ALLOWED = new Set([
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "strong",
  "em",
  "br",
]);

/**
 * Keeps only the allowed tags, and on them only href (http(s)), src (from the allowed hosts) and
 * alt. Everything else is dropped with its attributes; text is kept. Script and style contents
 * are dropped whole.
 */
export function sanitizeHtml(
  html: string,
  imageHosts: readonly string[],
): string {
  const withoutDangerous = html.replace(
    /<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  return withoutDangerous.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (whole, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED.has(tag)) return "";
      if (whole.startsWith("</")) return `</${tag}>`;
      const kept: string[] = [];
      if (tag === "a") {
        const href = /\bhref\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
        if (href !== undefined && /^https?:\/\//i.test(href))
          kept.push(`href="${escapeHtml(href)}"`);
      }
      if (tag === "img") {
        const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
        const alt = /\balt\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
        const ok = ((): boolean => {
          try {
            return (
              src !== undefined && imageHosts.includes(new URL(src).hostname)
            );
          } catch {
            return false;
          }
        })();
        if (!ok) return "";
        kept.push(`src="${escapeHtml(src!)}"`, `alt="${escapeHtml(alt)}"`);
      }
      return `<${tag}${kept.length === 0 ? "" : ` ${kept.join(" ")}`}>`;
    },
  );
}
