import { describe, expect, it } from "vitest";
import {
  formatFrontDate,
  pickPlates,
  romanNumeral,
  signed,
} from "../lib/front";

// ADR-020, spec 06: the front page's date line, plate numerals and plate choice.

describe("formatFrontDate", () => {
  it("prints the weekday, day, month and year without a comma, in UTC", () => {
    expect(formatFrontDate(new Date("2026-11-09T23:30:00Z"))).toBe(
      "Monday 9 November 2026",
    );
    expect(formatFrontDate(new Date("2026-01-01T00:00:00Z"))).toBe(
      "Thursday 1 January 2026",
    );
  });
});

describe("romanNumeral", () => {
  it("numbers the plates", () => {
    expect([1, 2, 3, 4, 5, 9, 12, 39].map(romanNumeral)).toEqual([
      "I",
      "II",
      "III",
      "IV",
      "V",
      "IX",
      "XII",
      "XXXIX",
    ]);
  });
  it("refuses what it cannot print", () => {
    expect(() => romanNumeral(0)).toThrow(RangeError);
    expect(() => romanNumeral(40)).toThrow(RangeError);
    expect(() => romanNumeral(1.5)).toThrow(RangeError);
  });
});

describe("pickPlates", () => {
  const ships = [
    { slug: "gladius", length: 20.5, hasPicture: true },
    { slug: "perseus", length: 100, hasPicture: true },
    { slug: "polaris", length: 155, hasPicture: true },
    { slug: "odin", length: 752, hasPicture: false },
    { slug: "carrack", length: 126.5, hasPicture: false },
  ];
  it("puts the live example first, the concept hero second, then the longest other ship with a picture", () => {
    expect(pickPlates(ships, "perseus", "odin").map((s) => s.slug)).toEqual([
      "perseus",
      "odin",
      "polaris",
    ]);
  });
  it("falls back to the longest ship when none of the rest has a picture", () => {
    const bare = ships.map((s) => ({ ...s, hasPicture: false }));
    expect(pickPlates(bare, "perseus", "odin").map((s) => s.slug)).toEqual([
      "perseus",
      "odin",
      "polaris",
    ]);
    const unknown = bare.map((s) => ({ ...s, length: null }));
    expect(pickPlates(unknown, "perseus", "odin")).toHaveLength(3);
  });
  it("takes more of the longest pictured ships when asked", () => {
    expect(pickPlates(ships, "perseus", "odin", 3).map((s) => s.slug)).toEqual([
      "perseus",
      "odin",
      "polaris",
      "gladius",
    ]);
  });
  it("leaves a missing showcase ship's plate out instead of promoting another", () => {
    expect(pickPlates(ships, "perseus", "nova").map((s) => s.slug)).toEqual([
      "perseus",
      "polaris",
    ]);
    expect(pickPlates([], "perseus", "odin")).toEqual([]);
  });
});

describe("signed", () => {
  const plain = (n: number): string => String(n);
  it("signs a change with a plus or a minus sign, never for zero", () => {
    expect(signed(21, plain)).toBe("+21");
    expect(signed(-3, plain)).toBe("−3");
    expect(signed(0, plain)).toBe("0");
  });
});

// ADR-038: the featured developer posts and the bento's daily draw.

import {
  FEATURED_REACH_HOURS,
  FEATURED_WINDOW_HOURS,
  dailyPicks,
  featuredPosts,
  utcDayNumber,
} from "../lib/front";

describe("featuredPosts", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  let n = 0;
  /** A post `hoursAgo` in `thread`; an `opener` is the thread's own page, a reply has a number. */
  const post = (
    hoursAgo: number,
    thread: string | null,
    { opener = false, url }: { opener?: boolean; url?: string } = {},
  ) => ({
    published_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    thread_id: thread,
    url:
      url ??
      (opener
        ? `https://example.test/thread/${thread}`
        : `https://example.test/thread/${thread ?? "none"}/${(n += 1)}`),
  });

  it("takes the threads staff opened in the window first, one post per thread, newest first, five at most", () => {
    const posts = [
      post(1, "patch"),
      post(2, "iae"),
      post(3, "patch", { opener: true }),
      post(4, "iae", { opener: true }),
      post(5, "pizza"),
      post(6, "launcher", { opener: true }),
      post(7, "pumpkin", { opener: true }),
      post(8, "contest", { opener: true }),
      post(9, "sale", { opener: true }),
      post(10, "armor"),
      post(100, "old", { opener: true }),
    ];
    const picked = featuredPosts(posts, now);
    expect(picked.map((p) => p.thread_id)).toEqual([
      "patch",
      "iae",
      "launcher",
      "pumpkin",
      "contest",
    ]);
    // The thread's newest post stands for it, an opener or not.
    expect(picked[0]).toBe(posts[0]);
  });

  it("counts a thread staff opened long ago as theirs when they post in it again", () => {
    // The live case: patch notes opened weeks ago, a staff reply today; the thread leads over a
    // younger thread staff only answered in.
    const posts = [
      post(2, "answered"),
      post(5, "notes"),
      post(500, "notes", { opener: true }),
    ];
    expect(featuredPosts(posts, now).map((p) => p.thread_id)).toEqual([
      "notes",
      "answered",
    ]);
  });

  it("reaches back to 72 hours for staff-opened threads before taking threads staff only answered in", () => {
    const posts = [
      post(1, "a", { opener: true }),
      post(2, "reply-x"),
      post(60, "b", { opener: true }),
      post(70, "c", { opener: true }),
      post(80, "d", { opener: true }),
      post(5, "reply-y"),
    ];
    expect(featuredPosts(posts, now).map((p) => p.thread_id)).toEqual([
      "a",
      "b",
      "c",
      "reply-x",
      "reply-y",
    ]);
  });

  it("orders the threads staff only answered in newest first, including one between 48 and 72 hours", () => {
    const posts = [
      post(1, "a", { opener: true }),
      post(2, "x"),
      post(60, "late"),
      post(3, "y"),
      post(4, "z"),
      post(80, "old"),
    ];
    expect(featuredPosts(posts, now).map((p) => p.thread_id)).toEqual([
      "a",
      "x",
      "y",
      "z",
      "late",
    ]);
    // Past 72 hours an answered thread is out of the tier: only the floor would bring it back.
    const fewer = [
      post(1, "b", { opener: true }),
      post(2, "w"),
      post(80, "older"),
    ];
    expect(
      featuredPosts(fewer, now, { min: 2 }).map((p) => p.thread_id),
    ).toEqual(["b", "w"]);
  });

  it("fills to three with the newest remaining threads when the windows hold fewer", () => {
    const posts = [
      post(1, "a", { opener: true }),
      post(90, "b"),
      post(91, "b"),
      post(200, "c"),
    ];
    expect(featuredPosts(posts, now).map((p) => p.thread_id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(featuredPosts(posts.slice(0, 2), now)).toHaveLength(2);
    expect(featuredPosts([], now)).toEqual([]);
  });

  it("sorts what it is given and keys a post without a thread id by its thread's address", () => {
    const posts = [
      post(30, null, { url: "https://example.test/thread/one/3" }),
      post(2, null, { url: "https://example.test/thread/two/9" }),
      post(10, "t"),
      post(5, null, { url: "https://example.test/thread/two/7" }),
    ];
    expect(featuredPosts(posts, now)).toEqual([posts[1], posts[2], posts[0]]);
    expect(FEATURED_WINDOW_HOURS).toBe(48);
    expect(FEATURED_REACH_HOURS).toBe(72);
    // Nothing inside a one-hour window: the fill supplies the minimum, one post.
    expect(
      featuredPosts(posts, now, { hours: 1, reach: 1, min: 1, max: 5 }),
    ).toHaveLength(1);
  });
});

describe("dailyPicks", () => {
  const ships = Array.from({ length: 40 }, (_, i) => ({
    slug: `ship-${i}`,
    length: i,
    hasPicture: i % 2 === 0,
  }));

  it("draws the same ships for one day and others for another", () => {
    const today = dailyPicks(ships, 20767, 3);
    expect(dailyPicks(ships, 20767, 3)).toEqual(today);
    expect(today).toHaveLength(3);
    expect(new Set(today.map((s) => s.slug)).size).toBe(3);
    const days = new Set(
      [20768, 20769, 20770, 20771].map((d) =>
        dailyPicks(ships, d, 3)
          .map((s) => s.slug)
          .join(","),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });

  it("draws only from ships with a picture, and from all of them when none has one", () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(dailyPicks(ships, d, 3).every((s) => s.hasPicture)).toBe(true);
    }
    const bare = ships.map((s) => ({ ...s, hasPicture: false }));
    expect(dailyPicks(bare, 7, 3)).toHaveLength(3);
    expect(dailyPicks(bare.slice(0, 2), 7, 3)).toHaveLength(2);
    expect(dailyPicks([], 7, 3)).toEqual([]);
  });

  it("seeds from the UTC day", () => {
    expect(utcDayNumber(new Date("2026-11-10T23:59:00Z"))).toBe(
      utcDayNumber(new Date("2026-11-10T00:01:00Z")),
    );
    expect(utcDayNumber(new Date("2026-11-11T00:00:00Z"))).toBe(
      utcDayNumber(new Date("2026-11-10T12:00:00Z")) + 1,
    );
  });
});

// ADR-058: the lead story outside a show.

import { LEAD_PAIR_DAYS, PROMOTION, leadStory, storyKey } from "../lib/front";

describe("leadStory", () => {
  const now = new Date("2026-11-12T19:00:00Z");
  const c = (
    source: "comm_link" | "video",
    title: string,
    published_at: string,
    hasPicture = true,
  ) => ({ source, title, published_at, hasPicture });

  it("takes the latest day before today, a Comm-Link before a video, the newest first", () => {
    const picked = leadStory(
      [
        c("comm_link", "Today's news", "2026-11-12T16:00:00Z"),
        c("video", "Yesterday's video", "2026-11-11T20:00:00Z"),
        c("comm_link", "Yesterday's morning post", "2026-11-11T09:00:00Z"),
        c("comm_link", "Yesterday's evening post", "2026-11-11T18:00:00Z"),
        c("comm_link", "An older post", "2026-11-09T18:00:00Z"),
      ],
      now,
    );
    expect(picked?.lead.title).toBe("Yesterday's evening post");
  });

  it("holds through quiet days and changes when the day turns", () => {
    const list = [
      c("comm_link", "Monday's post", "2026-11-09T18:00:00Z"),
      c("comm_link", "Thursday's post", "2026-11-12T10:00:00Z"),
    ];
    expect(leadStory(list, now)?.lead.title).toBe("Monday's post");
    expect(leadStory(list, new Date("2026-11-13T00:05:00Z"))?.lead.title).toBe(
      "Thursday's post",
    );
  });

  it("leads with a video on a day without a Comm-Link", () => {
    const picked = leadStory(
      [
        c("comm_link", "Older post", "2026-11-09T18:00:00Z"),
        c("video", "A video", "2026-11-11T18:00:00Z"),
      ],
      now,
    );
    expect(picked).toEqual({
      lead: c("video", "A video", "2026-11-11T18:00:00Z"),
      video: null,
    });
  });

  it("takes only candidates with a picture, all of them when none has one", () => {
    const bare = c("comm_link", "Bare", "2026-11-11T18:00:00Z", false);
    const pictured = c("comm_link", "Pictured", "2026-11-10T18:00:00Z");
    expect(leadStory([bare, pictured], now)?.lead.title).toBe("Pictured");
    expect(leadStory([bare], now)?.lead.title).toBe("Bare");
    expect(leadStory([], now)).toBeNull();
  });

  it("pairs a Comm-Link with the video of its story, before or after it, within three days", () => {
    const title = "Star Citizen | Behind the Ships: RSI Galaxy";
    // RSI's own case: the video at 16:39, the Comm-Link at 22:00 the same day.
    const post = c("comm_link", title, "2026-11-09T22:00:00Z");
    const film = c("video", title, "2026-11-09T16:39:01Z");
    const at = new Date("2026-11-10T12:00:00Z");
    expect(leadStory([post, film], at)).toEqual({ lead: post, video: film });
    // Three days apart still pairs; a moment past it does not.
    const edge = c("video", title, "2026-11-06T22:00:00Z");
    const past = c("video", title, "2026-11-06T21:59:00Z");
    expect(leadStory([post, edge], at)?.video).toEqual(edge);
    expect(leadStory([post, past], at)?.video).toBeNull();
  });

  it("never pairs a video published today, so the card holds for the day", () => {
    const title = "Star Citizen | Behind the Ships: RSI Galaxy";
    const post = c("comm_link", title, "2026-11-09T22:00:00Z");
    const today = c("video", title, "2026-11-10T09:00:00Z");
    expect(
      leadStory([post, today], new Date("2026-11-10T12:00:00Z"))?.video,
    ).toBeNull();
  });

  it("breaks a tie on the time by the title, so every build agrees", () => {
    const a = c(
      "comm_link",
      "This Week in Star Citizen",
      "2026-11-09T22:00:00Z",
    );
    const b = c("comm_link", "Behind the Ships", "2026-11-09T22:00:00Z");
    expect(leadStory([a, b], now)?.lead).toEqual(b);
    expect(leadStory([b, a], now)?.lead).toEqual(b);
  });

  it("prefers a picture only within three days of the latest story, then leads in words", () => {
    const old = c("video", "A video from October", "2026-10-23T18:00:00Z");
    const bare = c(
      "comm_link",
      "Yesterday's post",
      "2026-11-11T18:00:00Z",
      false,
    );
    // An old pictured video does not outrank a newer story whose cover is missing.
    expect(leadStory([old, bare], now)?.lead).toEqual(bare);
    // A pictured story within three days does.
    const recent = c(
      "video",
      "A video of two days ago",
      "2026-11-09T18:00:00Z",
    );
    expect(leadStory([old, bare, recent], now)?.lead).toEqual(recent);
    expect(LEAD_PAIR_DAYS).toBeGreaterThan(1);
  });

  it("leaves a store promotion out while anything else is on the pack", () => {
    const bundle = c(
      "comm_link",
      "Monthly Store Bundle 2026",
      "2026-11-11T16:00:00Z",
    );
    const film = c(
      "video",
      "Squadron 42 | Inside CIG: Community Gameplay Event",
      "2026-11-10T16:00:00Z",
    );
    expect(leadStory([bundle, film], now)?.lead).toEqual(film);
    expect(leadStory([bundle], now)?.lead).toEqual(bundle);
    for (const title of [
      "Twitch Drops: IAE 2956",
      "November 2026 Subscriber Promotions",
      "Anniversary Sale",
    ]) {
      expect(PROMOTION.test(title)).toBe(true);
    }
    for (const title of [
      "Intergalactic Aerospace Expo 2956 Free Fly and Manufacturer Schedule",
      "This Week in Star Citizen",
    ]) {
      expect(PROMOTION.test(title)).toBe(false);
    }
  });

  it("keys a story by its title without CIG's prefix and punctuation", () => {
    expect(storyKey("Star Citizen | Behind the Ships: RSI Galaxy")).toBe(
      storyKey("Behind the Ships - RSI Galaxy"),
    );
    expect(storyKey("Squadron 42 | Inside CIG")).toBe("insidecig");
  });
});
