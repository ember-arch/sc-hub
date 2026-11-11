import { describe, expect, it } from "vitest";
import {
  CONTENTS,
  formatFrontDate,
  pickPlates,
  romanNumeral,
  signed,
} from "../lib/front";

// ADR-020, spec 06: the front page's contents, date line, plate numerals and plate choice.

describe("contents", () => {
  it("lists every section once, numbered in reading order", () => {
    expect(CONTENTS.map((c) => c.number)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
    ]);
    expect(new Set(CONTENTS.map((c) => c.href)).size).toBe(CONTENTS.length);
    expect(CONTENTS.map((c) => c.href)).toEqual([
      "/ships",
      "/components",
      "/titles",
      "/news",
      "/about",
    ]);
  });
});

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
  FEATURED_WINDOW_HOURS,
  dailyPicks,
  featuredPosts,
  utcDayNumber,
} from "../lib/front";

describe("featuredPosts", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  let n = 0;
  const post = (
    hoursAgo: number,
    thread: string | null,
    url = `https://example.test/thread/${thread ?? "none"}/${(n += 1)}`,
  ) => ({
    published_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    thread_id: thread,
    url,
  });

  it("takes one post per thread from the window, the newest of each, newest thread first, five at most", () => {
    const posts = [
      post(1, "patch"),
      post(2, "iae"),
      post(3, "patch"),
      post(5, "pizza"),
      post(10, "armor"),
      post(20, "pumpkin"),
      post(21, "pumpkin"),
      post(30, "launcher"),
      post(100, "old"),
    ];
    const picked = featuredPosts(posts, now);
    expect(picked.map((p) => p.thread_id)).toEqual([
      "patch",
      "iae",
      "pizza",
      "armor",
      "pumpkin",
    ]);
    expect(picked[0]).toBe(posts[0]);
  });

  it("fills to three with the newest posts outside the window when the window holds fewer threads", () => {
    const posts = [post(1, "a"), post(60, "b"), post(61, "b"), post(90, "c")];
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
      post(30, null, "https://example.test/thread/one/3"),
      post(2, null, "https://example.test/thread/two/9"),
      post(10, "t"),
      post(5, null, "https://example.test/thread/two/7"),
    ];
    expect(featuredPosts(posts, now)).toEqual([posts[1], posts[2], posts[0]]);
    expect(FEATURED_WINDOW_HOURS).toBe(48);
    // Nothing inside a one-hour window: the fill supplies the minimum, one post.
    expect(
      featuredPosts(posts, now, { hours: 1, min: 1, max: 5 }),
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
