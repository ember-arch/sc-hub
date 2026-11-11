import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient } from "../src/client.js";
import {
  CHANNELS,
  FeedShapeError,
  feedUrl,
  parseFeed,
  pollVideos,
  summaryOf,
  toIncoming,
  videosDue,
} from "../src/sources/video.js";
import { openStore } from "../src/store.js";

// ADR-050: the two channels' Atom feeds, as fetched on 2026-11-11, in fixtures/news/samples.
const samples = new URL("../../../fixtures/news/samples/", import.meta.url);
const read = (name: string): string =>
  readFileSync(new URL(name, samples), "utf8");
const starCitizenXml = read("youtube-star-citizen.sample.xml");
const squadronXml = read("youtube-squadron-42.sample.xml");
const [starCitizen, squadron] = CHANNELS as [
  (typeof CHANNELS)[number],
  (typeof CHANNELS)[number],
];

describe("parseFeed", () => {
  it("reads every entry of a channel's feed, newest first, with its id, title, link and time", () => {
    const entries = parseFeed(starCitizenXml, starCitizen);
    expect(entries).toHaveLength(15);
    const first = entries[0]!;
    expect(first.videoId).toBe("yFQ6H0gKric");
    expect(first.title).toBe("Star Citizen | Behind the Ships: RSI Galaxy");
    expect(first.url).toBe("https://www.youtube.com/shorts/yFQ6H0gKric");
    expect(first.publishedAt).toBe("2026-11-10T19:01:05.000Z");
    expect(first.description).toMatch(/^Hold your breath, RSI fans/);
    for (const e of entries) {
      expect(e.url).toMatch(
        /^https:\/\/www\.youtube\.com\/(watch\?v=|shorts\/)[A-Za-z0-9_-]{11}$/,
      );
      expect(e.channelId).toBe(starCitizen.id);
    }
    const times = entries.map((e) => e.publishedAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("reads the Squadron 42 channel too, and decodes the feed's entities", () => {
    const entries = parseFeed(squadronXml, squadron);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.title)).toEqual([
      "Squadron 42 | Inside CIG: Community Gameplay Event",
      "Squadron 42 | Official Wishlist Trailer | The Oath",
    ]);
    expect(entries.every((e) => !/&(amp|quot|#39);/.test(e.title))).toBe(true);
  });

  it("halts on a feed for another channel, or an entry without its id", () => {
    expect(() => parseFeed(starCitizenXml, squadron)).toThrow(FeedShapeError);
    const broken = starCitizenXml.replace(
      "<yt:videoId>yFQ6H0gKric</yt:videoId>",
      "",
    );
    expect(() => parseFeed(broken, starCitizen)).toThrow(/lacks its id/);
    const elsewhere = starCitizenXml.replace(
      'href="https://www.youtube.com/shorts/yFQ6H0gKric"',
      'href="https://example.com/yFQ6H0gKric"',
    );
    expect(() => parseFeed(elsewhere, starCitizen)).toThrow(/not its watch/);
  });
});

describe("toIncoming", () => {
  it("makes a video item: the video's id, its page, the first paragraph as the summary, the channel in forum", () => {
    const entry = parseFeed(squadronXml, squadron)[0]!;
    const item = toIncoming(entry, squadron);
    expect(item.source).toBe("video");
    expect(item.external_id).toBe(entry.videoId);
    expect(item.url).toBe(entry.url);
    expect(item.forum).toBe("Squadron 42");
    expect(item.summary).toBe(summaryOf(entry.description));
    expect(item.body_html.startsWith("<p>")).toBe(true);
    expect(item.body_html).not.toMatch(/<(script|iframe|a)\b/);
    expect(item.author_id).toBeNull();
  });

  it("takes the description's first paragraph, or null for none", () => {
    expect(summaryOf("First line\nstill first.\n\nSecond.")).toBe(
      "First line still first.",
    );
    expect(summaryOf("  \n\n ")).toBeNull();
  });
});

describe("videosDue", () => {
  it("reads the feeds on the first of the hour's two runs only", () => {
    expect(videosDue(new Date("2026-11-11T18:07:00Z"))).toBe(true);
    expect(videosDue(new Date("2026-11-11T18:37:00Z"))).toBe(false);
  });
});

describe("pollVideos", () => {
  const quiet = {
    sleep: async () => undefined,
    now: () => 0,
    contact: "x@example.com",
  };
  const feeds = new Map([
    [feedUrl(starCitizen), starCitizenXml],
    [feedUrl(squadron), squadronXml],
  ]);
  const fetchFeed = async (url: string) => {
    const text = feeds.get(url);
    if (text === undefined) throw new Error(`unexpected ${url}`);
    return { ok: true, status: 200, text: async () => text };
  };

  it("records both channels' videos once, and nothing on a second run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    const client = createClient({ fetch: fetchFeed, ...quiet });
    const at = () => new Date("2026-11-11T18:07:00Z");
    const first = await pollVideos(client, store, at);
    expect(first.channels).toBe(2);
    expect(first.entries).toBe(17);
    expect(first.added + first.older).toBe(17);
    expect(first.added).toBeGreaterThan(0);
    const second = await pollVideos(client, store, at);
    expect(second.added).toBe(0);
    expect(second.revised).toBe(0);
    expect(client.requests).toBe(4);
    const videos = store.latest().filter((r) => r.source === "video");
    expect(new Set(videos.map((v) => v.forum))).toEqual(
      new Set(["Star Citizen", "Squadron 42"]),
    );
  });
});
