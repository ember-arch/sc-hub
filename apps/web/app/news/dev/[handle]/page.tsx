import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPost, EmptyState, formatDate } from "ui";
import { Masthead } from "../../../masthead";
import { repo } from "../../../../lib/data";
import { authorByHandle, devPosts, postsBy } from "../../../../lib/dev-posts";
import { Site, now } from "../../../../lib/site";
import { NewsTabs } from "../../tabs";

interface Params {
  readonly params: Promise<{ handle: string }>;
}

export function generateStaticParams() {
  return repo().authors.map((a) => ({ handle: a.handle }));
}

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
 * developer's posts newest first, each in full with its source link. No avatar, no detail beyond
 * what Spectrum shows beside a post.
 */
export default async function AuthorPage({ params }: Params) {
  const { handle } = await params;
  const author = authorFor(handle);
  const r = repo();
  const posts = postsBy(devPosts(r.news), author);
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
        {posts.length === 0 ? (
          <EmptyState>No posts on record for this developer.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <DevPost
                key={post.id}
                author={{ name: author.display_name, role: author.role }}
                thread={post.thread_title}
                publishedAt={post.published_at}
                now={at}
                bodyHtml={post.body_html}
                sourceUrl={post.url}
              />
            ))}
          </div>
        )}
      </div>
    </Site>
  );
}
