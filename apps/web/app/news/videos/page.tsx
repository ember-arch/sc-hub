import type { Metadata } from "next";
import { EmptyState, TextLink, VideoCard } from "ui";
import { VIDEO_CREDIT } from "ui/legal";
import { repo, spectrumOn } from "../../../lib/data";
import { Site, now } from "../../../lib/site";
import {
  VIDEO_CHANNELS,
  channelOf,
  parseChannel,
  videoCard,
  videosOf,
} from "../../../lib/videos";
import { Masthead } from "../../masthead";
import { Chip } from "../chip";
import { NewsTabs } from "../tabs";
import { VideoPlayer } from "./player";

export const metadata: Metadata = {
  title: "Videos",
  alternates: { canonical: "/news/videos" },
};

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Videos per page: six rows of four on a desktop. */
export const VIDEO_PAGE_SIZE = 24;

/**
 * The videos (ADR-050), the news page's third tab: CIG's uploads on the Star Citizen and
 * Squadron 42 YouTube channels, newest first, as cards with YouTube's thumbnails; a chip per
 * channel; twenty-four a page. A card opens the player in place, and every card links the
 * video on YouTube.
 */
export default async function VideosPage({ searchParams }: Props) {
  const params = await searchParams;
  const channel = parseChannel(params.channel);
  const pageRaw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;
  const r = repo();
  const at = now();
  const every = videosOf(r.videos, undefined);
  const present = VIDEO_CHANNELS.filter((c) =>
    every.some((v) => channelOf(v) === c),
  );
  const all = videosOf(r.videos, channel);
  const pages = Math.max(1, Math.ceil(all.length / VIDEO_PAGE_SIZE));
  const items = all.slice((page - 1) * VIDEO_PAGE_SIZE, page * VIDEO_PAGE_SIZE);
  const pageHref = (p: number): string => {
    const q = new URLSearchParams();
    if (channel !== undefined) q.set("channel", channel);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s === "" ? "/news/videos" : `/news/videos?${s}`;
  };
  return (
    <Site
      current="news"
      stage={
        <Masthead
          eyebrow={[
            every.length === 0
              ? "Feed not yet connected"
              : `${all.length} ${all.length === 1 ? "video" : "videos"}`,
            VIDEO_CHANNELS.join(", "),
          ]}
          title="Videos"
          lede="CIG's latest on YouTube, newest first: press a video to watch it here, or follow its link to YouTube."
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        <NewsTabs current="/news/videos" devOn={spectrumOn()} />
        {present.length > 1 ? (
          <nav
            aria-label="Channels"
            className="flex flex-wrap gap-2 text-caption"
          >
            <Chip
              href="/news/videos"
              active={channel === undefined}
              label="All"
            />
            {present.map((c) => (
              <Chip
                key={c}
                href={`/news/videos?channel=${encodeURIComponent(c)}`}
                active={channel === c}
                label={c}
              />
            ))}
          </nav>
        ) : null}
        {items.length === 0 ? (
          <EmptyState>
            {every.length === 0
              ? "No videos yet. CIG's uploads appear here within the hour once the feed has been read."
              : all.length === 0
                ? "No videos from this channel. Choose another channel above."
                : "No more videos. Go back a page."}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, i) => (
                <li key={item.id}>
                  <VideoCard
                    {...videoCard(item, at)}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    priority={i < 4}
                  />
                </li>
              ))}
            </ul>
            <p className="m-0 text-caption text-muted">{VIDEO_CREDIT.text}</p>
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
      <VideoPlayer />
    </Site>
  );
}
