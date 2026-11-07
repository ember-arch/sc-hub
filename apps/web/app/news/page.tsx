import type { Metadata } from "next";
import NextLink from "next/link";
import { ContentSource } from "schema";
import { EmptyState, FeedItem, sentence } from "ui";
import { repo } from "../../lib/data";
import { Site, now } from "../../lib/site";
import { NewsTabs } from "./tabs";

export const metadata: Metadata = { title: "News" };

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SOURCE_LABEL: Record<ContentSource, string> = {
  comm_link: "Comm-Link",
  patch_notes: "Patch notes",
  roadmap: "Roadmap",
  progress_tracker: "Progress tracker",
  video: "Video",
  spectrum: "Spectrum",
};

/** News feed: source filter chips, then FeedItems newest first. Paging and RSS arrive with spec 03. */
export default async function NewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = typeof params.source === "string" ? params.source : undefined;
  const parsed = raw === undefined ? undefined : ContentSource.safeParse(raw);
  const source = parsed?.success === true ? parsed.data : undefined;
  const r = repo();
  const present = ContentSource.options.filter((s) =>
    r.news.some((n) => n.source === s),
  );
  const items = r.news.filter(
    (n) => source === undefined || n.source === source,
  );
  const at = now();
  return (
    <Site current="news">
      <div className="flex flex-col gap-8 pt-8">
        <h1 className="text-title text-primary">News</h1>
        <NewsTabs current="/news" />
        <nav aria-label="Sources" className="flex flex-wrap gap-2 text-caption">
          <Chip href="/news" active={source === undefined} label="All" />
          {present.map((s) => (
            <Chip
              key={s}
              href={`/news?source=${s}`}
              active={source === s}
              label={SOURCE_LABEL[s]}
            />
          ))}
        </nav>
        {items.length === 0 ? (
          <EmptyState>
            {r.news.length === 0
              ? "No news yet. The Comm-Link poller arrives with spec 03; until then the feed shows the news fixture when one exists."
              : "No items from this source. Choose another source above."}
          </EmptyState>
        ) : (
          <div className="flex flex-col">
            {items.map((item) => (
              <FeedItem
                key={item.id}
                source={SOURCE_LABEL[item.source]}
                title={item.title}
                sourceUrl={item.url}
                publishedAt={item.published_at}
                now={at}
                excerpt={item.summary}
                entities={[]}
              />
            ))}
          </div>
        )}
      </div>
    </Site>
  );
}

function Chip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <NextLink
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-control border px-2 py-1 no-underline ${active ? "border-hairline-strong bg-accent-bg text-primary" : "border-hairline bg-inset text-secondary hover:text-primary"}`}
    >
      {label}
    </NextLink>
  );
}

export { sentence as _sentence };
