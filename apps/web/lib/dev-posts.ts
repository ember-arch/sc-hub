/**
 * The dev tracker's reading of the news pack (spec 03, "Dev tracker UI" and "Author pages"): the
 * Spectrum items, their authors, each post's thread address and its first lines for the folded
 * card (ADR-035). Pure functions over repository rows; no fetching here.
 */
import {
  type Author,
  type ContentItem,
  SPECTRUM_PICTURE_ID_SOURCE,
} from "schema";
import type { ResponsiveImage } from "ui";
import { SPECTRUM_IMAGE_CREDIT, SPECTRUM_IMAGE_PENDING } from "ui/legal";

/** The Spectrum items of the feed, newest first as the repository keeps them. */
export function devPosts(news: readonly ContentItem[]): ContentItem[] {
  return news.filter((n) => n.source === "spectrum");
}

/** The thread's own page: a reply's address ends in the post's number, which the thread's does not. */
export function threadUrl(post: ContentItem): string {
  return post.url.replace(/\/\d+$/, "");
}

/**
 * The post's first lines as plain text, for the folded card (ADR-035): the sanitized body with
 * its tags removed and its entities decoded, whitespace collapsed, cut at 280 characters on a
 * word; null for an empty post. Nothing is written that the post does not say.
 */
export function excerptOf(bodyHtml: string): string | null {
  const text = bodyHtml
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Last, so an escaped ampersand entity ("&amp;lt;") comes out as the text it was.
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return null;
  if (text.length <= 280) return text;
  const cut = text.slice(0, 280);
  const at = cut.lastIndexOf(" ");
  return `${at > 120 ? cut.slice(0, at) : cut}…`;
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Spectrum's picture id on an `img` the worker wrote: an upload's number or an embed's "e-" slug (ADR-037). */
const UPLOAD_IMG = new RegExp(
  `<img\\b([^>]*)\\bdata-upload="(${SPECTRUM_PICTURE_ID_SOURCE})"([^>]*)>`,
  "g",
);

/**
 * How wide a plate is drawn, for `sizes`: the content column (1400 px, `layout.contentMaxWidth`)
 * less the page's padding and the card's (16 px a side on phones, 24 px from md).
 */
export const PLATE_SIZES =
  "(min-width: 1400px) 1320px, (min-width: 768px) calc(100vw - 5rem), calc(100vw - 4rem)";

/**
 * The post's body as the page shows it (ADR-037): every picture the worker left as an `img` with
 * Spectrum's upload id becomes a plate across the card, the picture's web copies from the media
 * manifest with their credit under it, or, where the picture has not been copied yet, a captioned
 * placeholder with the same credit. Nothing is ever fetched from Spectrum by the reader's browser
 * (ADR-009). The rest of the HTML, sanitized by the worker, passes through untouched; the first
 * picture loads with the post, the rest lazily.
 */
export function renderBody(
  bodyHtml: string,
  picture: (uploadId: string) => ResponsiveImage | null,
  sourceUrl: string,
): string {
  return bodyHtml.replace(UPLOAD_IMG, (_whole, _before, uploadId: string) => {
    const found = picture(uploadId);
    const credit = `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="lab">${escapeHtml(SPECTRUM_IMAGE_CREDIT.text)}</a>`;
    if (found === null) {
      return `<figure class="dev-post-plate dev-post-plate-pending"><figcaption><span>${escapeHtml(SPECTRUM_IMAGE_PENDING)}</span>${credit}</figcaption></figure>`;
    }
    // The post runs across its card (ADR-035): the content column less the page's and the
    // card's padding, 1320 px at the widest.
    return `<figure class="dev-post-plate"><img src="${escapeHtml(found.src)}" srcset="${escapeHtml(found.srcSet)}" sizes="${PLATE_SIZES}" width="${found.width}" height="${found.height}" alt="" loading="lazy" decoding="async"><figcaption>${credit}</figcaption></figure>`;
  });
}

/** The author of a post, by the id the worker wrote on it. */
export function authorOf(
  post: ContentItem,
  authors: readonly Author[],
): Author | undefined {
  return post.author_id === null
    ? undefined
    : authors.find((a) => a.id === post.author_id);
}

/** An author by handle, case aside; handles are Spectrum's and unique. */
export function authorByHandle(
  authors: readonly Author[],
  handle: string,
): Author | undefined {
  const wanted = handle.toLowerCase();
  return authors.find((a) => a.handle.toLowerCase() === wanted);
}

/** The authors with at least one post shown, most posts first, then by name. */
export function authorsWithPosts(
  posts: readonly ContentItem[],
  authors: readonly Author[],
): Author[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.author_id !== null)
      counts.set(post.author_id, (counts.get(post.author_id) ?? 0) + 1);
  }
  return authors
    .filter((a) => counts.has(a.id))
    .sort(
      (a, b) =>
        counts.get(b.id)! - counts.get(a.id)! ||
        a.display_name.localeCompare(b.display_name, "en"),
    );
}

/** The posts by one author, in the order given. */
export function postsBy(
  posts: readonly ContentItem[],
  author: Author,
): ContentItem[] {
  return posts.filter((p) => p.author_id === author.id);
}
