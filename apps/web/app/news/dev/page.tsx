import type { Metadata } from "next";
import { DevPost, EmptyState, TextLink } from "ui";
import { Masthead } from "../../masthead";
import { repo, spectrumOn } from "../../../lib/data";
import {
  authorByHandle,
  authorOf,
  authorsWithPosts,
  devPosts,
  groupThreads,
  postsBy,
} from "../../../lib/dev-posts";
import { Site, now } from "../../../lib/site";
import { Chip } from "../chip";
import { NewsTabs } from "../tabs";

export const metadata: Metadata = {
  title: "Developer posts",
  alternates: { canonical: "/news/dev" },
};

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Threads per page. */
export const PAGE_SIZE = 20;

/**
 * The dev tracker (spec 03, "Dev tracker UI"): CIG staff posts from Spectrum, newest first, a
 * developer's posts in one thread under the thread's title with the newest open and the rest
 * folded, an author filter, the full text as the worker sanitized it, and the source link on
 * every post. Empty, with the reason, while the Spectrum module is off or has not run.
 */
export default async function DevTrackerPage({ searchParams }: Props) {
  const params = await searchParams;
  const r = repo();
  const on = spectrumOn();
  const posts = devPosts(r.news);
  const authors = authorsWithPosts(posts, r.authors);
  const handle = typeof params.author === "string" ? params.author : undefined;
  const author =
    handle === undefined ? undefined : authorByHandle(authors, handle);
  const shown = author === undefined ? posts : postsBy(posts, author);
  const threads = groupThreads(shown);
  const pageRaw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;
  const pages = Math.max(1, Math.ceil(threads.length / PAGE_SIZE));
  const slice = threads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number): string => {
    const q = new URLSearchParams();
    if (author !== undefined) q.set("author", author.handle);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s === "" ? "/news/dev" : `/news/dev?${s}`;
  };
  const at = now();
  return (
    <Site
      current="news"
      stage={
        <Masthead
          eyebrow={[
            !on
              ? "Tracker not yet connected"
              : posts.length === 0
                ? "No posts yet"
                : `${posts.length} posts by ${authors.length} ${authors.length === 1 ? "developer" : "developers"}`,
            "CIG staff on Spectrum",
          ]}
          title="Developer posts"
          lede="What CIG's developers say on Spectrum, newest first, each post in full with a link to the original."
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        <NewsTabs current="/news/dev" devOn={on} />
        {authors.length > 1 ? (
          <nav
            aria-label="Developers"
            className="flex flex-wrap gap-2 text-caption"
          >
            <Chip href="/news/dev" active={author === undefined} label="All" />
            {authors.map((a) => (
              <Chip
                key={a.id}
                href={`/news/dev?author=${encodeURIComponent(a.handle)}`}
                active={author?.id === a.id}
                label={a.display_name}
              />
            ))}
          </nav>
        ) : null}
        {slice.length === 0 ? (
          <EmptyState>
            {!on
              ? "No developer posts yet. Posts by CIG staff on Spectrum appear here once the tracker is connected."
              : posts.length === 0
                ? "No developer posts yet. The tracker has not read Spectrum."
                : shown.length === 0
                  ? "No posts by this developer. Choose another above."
                  : "No more posts. Go back a page."}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-10">
            {slice.map((thread) => {
              const [newest, ...older] = thread.posts;
              return (
                <section
                  key={thread.id}
                  aria-label={thread.title}
                  className="flex flex-col gap-3"
                >
                  <h2 className="m-0 flex flex-wrap items-baseline gap-x-3 text-heading text-primary">
                    <span>{thread.title}</span>
                    <TextLink
                      href={thread.url}
                      external
                      className="text-caption font-normal text-secondary"
                    >
                      Thread on Spectrum
                    </TextLink>
                  </h2>
                  {newest === undefined ? null : (
                    <Post post={newest} at={at} authors={r.authors} />
                  )}
                  {older.length > 0 ? (
                    <details className="rounded-card border border-hairline">
                      <summary className="cursor-pointer px-4 py-3 text-ui text-secondary">
                        {older.length === 1
                          ? "1 earlier post in this thread"
                          : `${older.length} earlier posts in this thread`}
                      </summary>
                      <div className="flex flex-col gap-3 px-4 pb-4">
                        {older.map((post) => (
                          <Post
                            key={post.id}
                            post={post}
                            at={at}
                            authors={r.authors}
                          />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
        {pages > 1 ? (
          <nav
            aria-label="Pages"
            className="flex flex-wrap items-center justify-between gap-2 text-caption text-secondary"
          >
            <span>
              Page {page} of {pages}
            </span>
            <span className="flex gap-3">
              {page > 1 ? (
                <TextLink href={pageHref(page - 1)}>Newer</TextLink>
              ) : null}
              {page < pages ? (
                <TextLink href={pageHref(page + 1)}>Older</TextLink>
              ) : null}
            </span>
          </nav>
        ) : null}
      </div>
    </Site>
  );
}

function Post({
  post,
  at,
  authors,
}: {
  readonly post: Parameters<typeof authorOf>[0];
  readonly at: Date;
  readonly authors: Parameters<typeof authorOf>[1];
}) {
  const author = authorOf(post, authors);
  return (
    <DevPost
      author={
        author === undefined
          ? { name: "CIG staff", role: null }
          : {
              name: author.display_name,
              role: author.role,
              href: `/news/dev/${encodeURIComponent(author.handle)}`,
            }
      }
      thread={null}
      publishedAt={post.published_at}
      now={at}
      bodyHtml={post.body_html}
      sourceUrl={post.url}
    />
  );
}
