import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPost, EmptyState, TextLink, formatDate } from "ui";
import { Masthead } from "../../../masthead";
import { repo } from "../../../../lib/data";
import {
  authorByHandle,
  devPosts,
  excerptOf,
  postsBy,
  threadUrl,
} from "../../../../lib/dev-posts";
import { Site, now } from "../../../../lib/site";
import { NewsTabs } from "../../tabs";

interface Params {
  readonly params: Promise<{ handle: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Posts per page: a developer with a year of replies gets pages, not one long scroll. */
export const PAGE_SIZE = 20;

// Rendered per request, like the tracker: the page reads `?page=`, and a prerendered route that
// reads search params answers an unknown handle with a 500 instead of the 404 the test expects.
export const dynamic = "force-dynamic";

function authorFor(handle: string) {
  const author = authorByHandle(repo().authors, decodeURIComponent(handle));
  if (author === undefined) notFound();
  return author;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const author = authorFor(handle);
  return {
    title: `${author.display_name} on Spectrum`,
    alternates: { canonical: `/news/dev/${encodeURIComponent(author.handle)}` },
  };
}

/**
 * An author page (spec 03, "Author pages"): handle, role, first seen and post count, then the
 * developer's posts newest first, twenty a page, each in full with its source link. No avatar,
 * no detail beyond what Spectrum shows beside a post.
 */
export default async function AuthorPage({ params, searchParams }: Params) {
  const { handle } = await params;
  const query = await searchParams;
  const author = authorFor(handle);
  const r = repo();
  const posts = postsBy(devPosts(r.news), author);
  const pageRaw = typeof query.page === "string" ? Number(query.page) : 1;
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;
  const pages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const shown = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = `/news/dev/${encodeURIComponent(author.handle)}`;
  const pageHref = (p: number): string => (p > 1 ? `${base}?page=${p}` : base);
  const at = now();
  return (
    <Site
      current="news"
      stage={
        <Masthead
          eyebrow={[
            author.role ?? "CIG staff",
            `First seen ${formatDate(author.first_seen)}`,
            `${author.post_count} ${author.post_count === 1 ? "post" : "posts"} on record`,
          ]}
          title={author.display_name}
          lede={`${author.handle} on Spectrum. Posts newest first, each linked to its original.`}
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        <NewsTabs current="/news/dev" devOn />
        {shown.length === 0 ? (
          <EmptyState>
            {posts.length === 0
              ? "No posts on record for this developer."
              : "No more posts. Go back a page."}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {shown.map((post) => (
              <DevPost
                key={post.id}
                title={post.thread_title ?? post.title}
                author={{ name: author.display_name, role: author.role }}
                publishedAt={post.published_at}
                now={at}
                bodyHtml={post.body_html}
                excerpt={excerptOf(post.body_html)}
                sourceUrl={post.url}
                threadUrl={threadUrl(post)}
              />
            ))}
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
