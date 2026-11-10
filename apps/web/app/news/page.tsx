import type { Metadata } from "next";
import { Masthead } from "../masthead";
import { ContentSource } from "schema";
import { EmptyState, FeedItem, TextLink } from "ui";
import { WIKI_CREDIT } from "ui/legal";
import { repo, spectrumOn } from "../../lib/data";
import { Site, now } from "../../lib/site";
import { Chip } from "./chip";
import { NewsTabs } from "./tabs";

export const metadata: Metadata = {
  title: "News",
  alternates: { canonical: "/news" },
};

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

/** Items per page (spec 03, "Feed UI"). */
export const PAGE_SIZE = 20;

/**
 * News feed (ADR-027): source filter chips when more than one source exists, then FeedItems
 * newest first, twenty a page; the RSS and JSON feeds linked; the wiki credited for the
 * Comm-Link text it supplies.
 */
export default async function NewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = typeof params.source === "string" ? params.source : undefined;
  const parsed = raw === undefined ? undefined : ContentSource.safeParse(raw);
  const source = parsed?.success === true ? parsed.data : undefined;
  const pageRaw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;
  const r = repo();
  const present = ContentSource.options.filter((s) =>
    r.news.some((n) => n.source === s),
  );
  const all = r.news.filter((n) => source === undefined || n.source === source);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number): string => {
    const q = new URLSearchParams();
    if (source !== undefined) q.set("source", source);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s === "" ? "/news" : `/news?${s}`;
  };
  const at = now();
  return (
    <Site
      current="news"
      stage={
        <Masthead
          eyebrow={[
            all.length === 0 ? "Feed not yet connected" : `${all.length} items`,
            "Comm-Links, patch notes, roadmap, video, Spectrum",
          ]}
          title="Dispatches"
          lede="What CIG publishes and what its developers say, in one feed, each item linked to its source and to the ships and parts it mentions."
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        <NewsTabs current="/news" devOn={spectrumOn()} />
        {present.length > 1 ? (
          <nav
            aria-label="Sources"
            className="flex flex-wrap gap-2 text-caption"
          >
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
        ) : null}
        {items.length === 0 ? (
          <EmptyState>
            {r.news.length === 0
              ? "No news yet. Comm-Links, patch notes and videos appear here once the feed is connected."
              : all.length === 0
                ? "No items from this source. Choose another source above."
                : "No more items. Go back a page."}
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
        {r.news.length === 0 ? null : (
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-caption text-secondary">
            <TextLink href="/news/rss.xml">RSS</TextLink>
            <TextLink href="/news/feed.json">JSON feed</TextLink>
            {r.news.some((n) => n.source === "comm_link") ? (
              <TextLink href={WIKI_CREDIT.url} external>
                Comm-Link text via the Star Citizen Wiki API
              </TextLink>
            ) : null}
          </p>
        )}
      </div>
    </Site>
  );
}
