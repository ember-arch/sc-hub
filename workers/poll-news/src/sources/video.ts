/**
 * The videos (spec 03, "Video poller"; ADR-050): the Star Citizen and Squadron 42 YouTube
 * channels each publish an Atom feed of their fifteen newest uploads, which answers without a key
 * or a sign-in. The poller reads both once an hour (CLAUDE.md section 9: YouTube RSS, one request
 * an hour) and records each upload as a content item of source `video`: the video's own id, its
 * page on YouTube, its title, the first paragraph of its description as the summary and the whole
 * description as escaped paragraphs, and the channel's name in `forum`, the field that names
 * where on its source an item was published (on Spectrum, its forum). The feed's view counts and
 * ratings are not kept: they change every hour and would make a revision of every video.
 */
import type { Client } from "../client.js";
import { decodeEntities, paragraphsHtml } from "../html.js";
import type { Store } from "../store.js";

export interface Channel {
  /** YouTube's id for the channel, `UC...`. */
  readonly id: string;
  /** The channel's name as YouTube shows it; recorded on every video as `forum`. */
  readonly name: string;
}

/** The two channels CIG publishes its videos on (ADR-050). */
export const CHANNELS: readonly Channel[] = [
  { id: "UCTeLqJq1mXUX5WWoNXLmOIA", name: "Star Citizen" },
  { id: "UCU-xYE7KrmqarZ3Lqu2PK_w", name: "Squadron 42" },
];

export const feedUrl = (channel: Channel): string =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;

export interface FeedEntry {
  readonly videoId: string;
  readonly channelId: string;
  readonly title: string;
  /** The watch page, or the Shorts page for a Short, as the feed links it. */
  readonly url: string;
  readonly publishedAt: string;
  readonly description: string;
}

/** A feed that is not the shape this parser knows halts the run (CLAUDE.md section 5). */
export class FeedShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedShapeError";
  }
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_URL =
  /^https:\/\/www\.youtube\.com\/(?:watch\?v=|shorts\/)([A-Za-z0-9_-]{11})$/;

const tag = (xml: string, name: string): string | undefined => {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(
    xml,
  );
  return match?.[1];
};

/** Every entry of a channel's Atom feed, in the feed's order (newest first). */
export function parseFeed(xml: string, channel: Channel): FeedEntry[] {
  const channelId = tag(xml, "yt:channelId");
  // The feed names its channel without the "UC" prefix; the entries name it in full.
  if (channelId === undefined || !channel.id.endsWith(channelId.trim())) {
    throw new FeedShapeError(
      `the feed for ${channel.name} does not name channel ${channel.id}`,
    );
  }
  const entries: FeedEntry[] = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1]!;
    const videoId = tag(entry, "yt:videoId")?.trim();
    const entryChannel = tag(entry, "yt:channelId")?.trim();
    const title = tag(entry, "title");
    const published = tag(entry, "published")?.trim();
    const link = /<link rel="alternate" href="([^"]+)"\s*\/>/.exec(entry)?.[1];
    const description = tag(entry, "media:description") ?? "";
    if (
      videoId === undefined ||
      !VIDEO_ID.test(videoId) ||
      title === undefined ||
      published === undefined ||
      Number.isNaN(Date.parse(published)) ||
      link === undefined
    ) {
      throw new FeedShapeError(
        `an entry of ${channel.name}'s feed lacks its id, title, time or link`,
      );
    }
    if (entryChannel !== channel.id) {
      throw new FeedShapeError(
        `entry ${videoId} in ${channel.name}'s feed names channel ${entryChannel ?? "none"}`,
      );
    }
    const url = decodeEntities(link);
    if (WATCH_URL.exec(url)?.[1] !== videoId) {
      throw new FeedShapeError(
        `entry ${videoId} links ${url}, not its watch or Shorts page`,
      );
    }
    entries.push({
      videoId,
      channelId: entryChannel,
      title: decodeEntities(title).trim(),
      url,
      publishedAt: new Date(published).toISOString(),
      description: decodeEntities(description).trim(),
    });
  }
  return entries;
}

/** The description's first paragraph, or null when the description is empty. */
export function summaryOf(description: string): string | null {
  const first = description
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .find((p) => p !== "");
  return first ?? null;
}

export function toIncoming(entry: FeedEntry, channel: Channel) {
  return {
    source: "video" as const,
    external_id: entry.videoId,
    url: entry.url,
    title: entry.title,
    summary: summaryOf(entry.description),
    body_html: paragraphsHtml(entry.description),
    published_at: entry.publishedAt,
    author_id: null,
    thread_id: null,
    thread_title: null,
    forum: channel.name,
  };
}

/**
 * Whether this run reads the feeds: the News workflow runs at 7 and 37 minutes past the hour
 * (ADR-027), and the feeds are read on the first run of each hour only, so each feed is asked
 * once an hour (CLAUDE.md section 9). A run started by hand for the video source alone reads them
 * regardless.
 */
export const videosDue = (now: Date): boolean => now.getUTCMinutes() < 30;

export interface VideoSummary {
  readonly channels: number;
  readonly entries: number;
  readonly added: number;
  readonly revised: number;
  readonly older: number;
}

export async function pollVideos(
  client: Client,
  store: Store,
  now: () => Date,
  channels: readonly Channel[] = CHANNELS,
): Promise<VideoSummary> {
  let entries = 0;
  let added = 0;
  let revised = 0;
  let older = 0;
  for (const channel of channels) {
    const xml = await client.text(feedUrl(channel));
    const fetchedAt = now().toISOString();
    for (const entry of parseFeed(xml, channel)) {
      entries += 1;
      const result = store.put(toIncoming(entry, channel), fetchedAt);
      if (result === "new") added += 1;
      else if (result === "revised") revised += 1;
      else if (result === "older") older += 1;
    }
  }
  return { channels: channels.length, entries, added, revised, older };
}
