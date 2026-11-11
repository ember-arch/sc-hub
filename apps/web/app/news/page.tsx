import type { Metadata } from "next";
import { Masthead } from "../masthead";
import { ContentSource } from "schema";
import { DispatchCard, EmptyState, TextLink } from "ui";
import { RSI_IMAGE_CREDIT, WIKI_CREDIT } from "ui/legal";
import { repo, spectrumOn } from "../../lib/data";
import { SOURCE_LABEL, coverOf } from "../../lib/dispatches";
import { Site, now } from "../../lib/site";
import { Chip } from "./chip";
import { NewsTabs } from "./tabs";

export const metadata: Metadata = {
  title: "Dispatches",
  alternates: { canonical: "/news" },
};

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Dispatches per page (spec 03, "Feed UI"): the lead and nineteen in the grid. */
export const PAGE_SIZE = 20;

/**
 * The sources a dispatch can come from: everything CIG publishes; developer posts are the
 * tracker's and videos the videos tab's (ADR-050).
 */
const DISPATCH_SOURCES = ContentSource.options.filter(
  (s) => s !== "spectrum" && s !== "video",
);

/**
 * The dispatches (ADR-027, ADR-029): what CIG publishes, newest first, as cards with their
 * covers: the page's newest as the lead, the rest in a grid, twenty a page; source chips when
 * more than one source is on record; the RSS and JSON feeds linked; the wiki credited for the
 * Comm-Link text it supplies and RSI for the covers. Developer posts from Spectrum are not here:
 * they have their own page.
 */
export default async function NewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = typeof params.source === "string" ? params.source : undefined;
  const parsed = raw === undefined ? undefined : ContentSource.safeParse(raw);
  const source =
    parsed?.success === true
      ? DISPATCH_SOURCES.find((s) => s === parsed.data)
      : undefined;
  const pageRaw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;
  const r = repo();
  const present = DISPATCH_SOURCES.filter((s) =>
    r.dispatches.some((n) => n.source === s),
  );
  const all = r.dispatches.filter(
    (n) => source === undefined || n.source === source,
  );
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const [lead, ...rest] = items;
  const pictures = new Map(items.map((item) => [item.id, coverOf(item)]));
  const anyPicture = [...pictures.values()].some((p) => p !== null);
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
            r.dispatches.length === 0
              ? "Feed not yet connected"
              : `${all.length} ${all.length === 1 ? "dispatch" : "dispatches"}`,
            present.length === 0
              ? "Comm-Links, patch notes, roadmap"
              : present.map((s) => SOURCE_LABEL[s]).join(", "),
          ]}
          title="Dispatches"
          lede="What CIG publishes, newest first, each dispatch linked to its original on the source site."
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
        {lead === undefined ? (
          <EmptyState>
            {r.dispatches.length === 0
              ? "No dispatches yet. Comm-Links, patch notes and roadmap changes appear here once the feed is connected."
              : all.length === 0
                ? "No dispatches from this source. Choose another source above."
                : "No more dispatches. Go back a page."}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            <DispatchCard
              source={SOURCE_LABEL[lead.source]}
              title={lead.title}
              sourceUrl={lead.url}
              publishedAt={lead.published_at}
              now={at}
              excerpt={lead.summary}
              picture={pictures.get(lead.id) ?? null}
              lead
              priority
            />
            {rest.length === 0 ? null : (
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((item) => (
                  <li key={item.id}>
                    <DispatchCard
                      source={SOURCE_LABEL[item.source]}
                      title={item.title}
                      sourceUrl={item.url}
                      publishedAt={item.published_at}
                      now={at}
                      excerpt={item.summary}
                      picture={pictures.get(item.id) ?? null}
                    />
                  </li>
                ))}
              </ul>
            )}
            {anyPicture ? (
              <p className="m-0 text-caption text-muted">
                {RSI_IMAGE_CREDIT.text}
              </p>
            ) : null}
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
        {r.dispatches.length === 0 ? null : (
          <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-caption text-secondary">
            <TextLink href="/news/rss.xml">RSS</TextLink>
            <TextLink href="/news/feed.json">JSON feed</TextLink>
            {r.dispatches.some((n) => n.source === "comm_link") ? (
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
