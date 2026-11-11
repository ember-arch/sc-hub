/**
 * The dev tracker's reading of the news pack (spec 03, "Dev tracker UI" and "Author pages"): the
 * Spectrum items, their authors, and the items grouped by thread so a developer's replies in one
 * thread sit under the thread's title. Pure functions over repository rows; no fetching here.
 */
import type { Author, ContentItem } from "schema";

export interface Thread {
  /** The Spectrum thread id, or the item's own id when the source gave none. */
  readonly id: string;
  readonly title: string;
  /** The thread on Spectrum: a reply's link without its post segment, an opening post's link as is. */
  readonly url: string;
  /** Newest first. */
  readonly posts: readonly ContentItem[];
}

/** The Spectrum items of the feed, newest first as the repository keeps them. */
export function devPosts(news: readonly ContentItem[]): ContentItem[] {
  return news.filter((n) => n.source === "spectrum");
}

/** The thread's own page: a reply's address ends in the post's number, which the thread's does not. */
export function threadUrl(post: ContentItem): string {
  return post.url.replace(/\/\d+$/, "");
}

/** Threads newest first by their newest post; within a thread, posts newest first. */
export function groupThreads(posts: readonly ContentItem[]): Thread[] {
  const byThread = new Map<string, ContentItem[]>();
  for (const post of posts) {
    const key = post.thread_id ?? post.id;
    const list = byThread.get(key);
    if (list === undefined) byThread.set(key, [post]);
    else list.push(post);
  }
  return [...byThread.entries()]
    .map(([id, list]) => {
      const sorted = [...list].sort((a, b) =>
        b.published_at.localeCompare(a.published_at),
      );
      const newest = sorted[0]!;
      const oldest = sorted[sorted.length - 1]!;
      return {
        id,
        title: newest.thread_title ?? newest.title,
        url: threadUrl(oldest),
        posts: sorted,
      };
    })
    .sort((a, b) =>
      b.posts[0]!.published_at.localeCompare(a.posts[0]!.published_at),
    );
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
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return null;
  if (text.length <= 280) return text;
  const cut = text.slice(0, 280);
  const at = cut.lastIndexOf(" ");
  return `${at > 120 ? cut.slice(0, at) : cut}…`;
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
