import type { ContentItem } from "schema";
import { describe, expect, it } from "vitest";
import {
  FRONT_VIDEOS,
  embedUrl,
  frontVideos,
  isShort,
  parseChannel,
  thumbnailOf,
  videoCard,
  videosOf,
} from "../lib/videos";

// ADR-050: the videos are content items of source `video` with the channel in `forum`; the
// cards take YouTube's own thumbnails and the privacy-enhanced player.

const item = (
  id: string,
  forum: string,
  published: string,
  url = `https://www.youtube.com/watch?v=${id}`,
): ContentItem => ({
  id: "00000000-0000-5000-8000-000000000000",
  source: "video",
  external_id: id,
  url,
  title: `Video ${id}`,
  summary: null,
  body_html: "",
  published_at: published,
  fetched_at: published,
  revision: 1,
  author_id: null,
  thread_id: null,
  thread_title: null,
  forum,
  takedown: false,
});

const videos = [
  item("aaaaaaaaaaa", "Star Citizen", "2026-11-09T10:00:00.000Z"),
  item("bbbbbbbbbbb", "Squadron 42", "2026-11-11T10:00:00.000Z"),
  item(
    "ccccccccccc",
    "Star Citizen",
    "2026-11-10T10:00:00.000Z",
    "https://www.youtube.com/shorts/ccccccccccc",
  ),
];

describe("videos", () => {
  it("lists newest first, all channels or one", () => {
    expect(videosOf(videos, undefined).map((v) => v.external_id)).toEqual([
      "bbbbbbbbbbb",
      "ccccccccccc",
      "aaaaaaaaaaa",
    ]);
    expect(videosOf(videos, "Star Citizen").map((v) => v.external_id)).toEqual([
      "ccccccccccc",
      "aaaaaaaaaaa",
    ]);
  });

  it("knows a Short by its page, and only the two channels as a filter", () => {
    expect(isShort(videos[2]!)).toBe(true);
    expect(isShort(videos[0]!)).toBe(false);
    expect(parseChannel("Squadron 42")).toBe("Squadron 42");
    expect(parseChannel("Elsewhere")).toBeUndefined();
    expect(parseChannel(["Squadron 42"])).toBeUndefined();
  });

  it("takes YouTube's own thumbnails, the 16:9 one as the fallback", () => {
    const thumb = thumbnailOf("aaaaaaaaaaa");
    expect(thumb.src).toBe("https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg");
    expect(thumb.srcSet).toBe(
      "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg 320w, https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg 480w",
    );
    expect([thumb.width, thumb.height]).toEqual([320, 180]);
  });

  it("addresses the privacy-enhanced player with autoplay, for the press that loads it", () => {
    expect(embedUrl("aaaaaaaaaaa")).toBe(
      "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?autoplay=1&rel=0&playsinline=1",
    );
    const card = videoCard(videos[2]!, new Date("2026-11-11T12:00:00Z"));
    expect(card.channel).toBe("Star Citizen");
    expect(card.short).toBe(true);
    expect(card.url).toBe("https://www.youtube.com/shorts/ccccccccccc");
    expect(card.embed).toBe(embedUrl("ccccccccccc"));
  });

  it("puts full videos only on the front page, newest first, and keeps Shorts for the tab", () => {
    expect(frontVideos(videos).map((v) => v.external_id)).toEqual([
      "bbbbbbbbbbb",
      "aaaaaaaaaaa",
    ]);
    expect(videosOf(videos, undefined)).toHaveLength(3);
  });

  it("carries at most five full videos on the front page, and none when there are only Shorts", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      item(
        `v${String(i).padStart(10, "0")}`,
        "Star Citizen",
        `2026-11-0${i + 1}T10:00:00.000Z`,
      ),
    );
    expect(frontVideos(many)).toHaveLength(FRONT_VIDEOS);
    expect(frontVideos(many)[0]!.external_id).toBe("v0000000007");
    const shorts = [videos[2]!];
    expect(frontVideos(shorts)).toEqual([]);
  });

  it("carries five to seven on the front page", () => {
    expect(FRONT_VIDEOS).toBeGreaterThanOrEqual(5);
    expect(FRONT_VIDEOS).toBeLessThanOrEqual(7);
  });
});
