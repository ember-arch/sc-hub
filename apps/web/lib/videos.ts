import type { ContentItem } from "schema";
import type { VideoCardProps } from "ui";

/**
 * The videos (ADR-050): CIG's uploads on its two YouTube channels, as the news worker records
 * them (source `video`, the channel's name in `forum`). A card's thumbnail is YouTube's own,
 * loaded from YouTube's image host and never copied; the player is YouTube's privacy-enhanced
 * embed, loaded only when a reader presses play.
 */

/** The channels in the order the tab's chips list them. */
export const VIDEO_CHANNELS = ["Star Citizen", "Squadron 42"] as const;
export type VideoChannel = (typeof VIDEO_CHANNELS)[number];

/** How many of the newest the front page's rail carries (owner, 2026-11-11: "5-7"). */
export const FRONT_VIDEOS = 7;

/** A Short's page is `/shorts/<id>`; a video's is `/watch?v=<id>`. */
export const isShort = (item: Pick<ContentItem, "url">): boolean =>
  /\/shorts\//.test(item.url);

/**
 * The privacy-enhanced player, started by the reader's press: nothing is embedded until then, and
 * the owner asked for the press to start the video (2026-11-11, "Yes, autoplay"; ADR-050).
 */
export const embedUrl = (videoId: string): string =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1`;

/**
 * YouTube's thumbnails for a video: the 16:9 one at 320 and the 4:3 one at 480, whose bands the
 * card's 16:9 frame crops away exactly. Every upload has both; the larger sizes are not promised.
 */
export function thumbnailOf(videoId: string): VideoCardProps["thumbnail"] {
  const base = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}`;
  return {
    src: `${base}/mqdefault.jpg`,
    srcSet: `${base}/mqdefault.jpg 320w, ${base}/hqdefault.jpg 480w`,
    width: 320,
    height: 180,
  };
}

export function channelOf(item: Pick<ContentItem, "forum">): string {
  return item.forum ?? "YouTube";
}

/** The props a card takes for one video. */
export function videoCard(
  item: ContentItem,
  now: Date,
): Omit<VideoCardProps, "priority" | "sizes"> {
  return {
    id: item.external_id,
    title: item.title,
    channel: channelOf(item),
    publishedAt: item.published_at,
    now,
    url: item.url,
    embed: embedUrl(item.external_id),
    short: isShort(item),
    thumbnail: thumbnailOf(item.external_id),
  };
}

/** The videos of one channel, or all of them, newest first. */
export function videosOf(
  videos: readonly ContentItem[],
  channel: VideoChannel | undefined,
): ContentItem[] {
  return [...videos]
    .filter((v) => channel === undefined || channelOf(v) === channel)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

export function parseChannel(raw: unknown): VideoChannel | undefined {
  return VIDEO_CHANNELS.find((c) => c === raw);
}
