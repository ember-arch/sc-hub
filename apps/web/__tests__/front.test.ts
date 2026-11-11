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
    {
      opener = false,
      likes,
      url,
    }: { opener?: boolean; likes?: number; url?: string } = {},
  ) => ({
    published_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    thread_id: thread,
    url:
      url ??
      (opener
        ? `https://example.test/thread/${thread}`
        : `https://example.test/thread/${thread ?? "none"}/${(n += 1)}`),
    ...(likes === undefined ? {} : { likes }),
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

  it("ranks threads staff only answered in by likes where recorded, newest first otherwise", () => {
    const posts = [
      post(1, "a", { opener: true }),
      post(2, "x", { likes: 3 }),
      post(3, "y", { likes: 40 }),
      post(4, "z"),
      post(5, "w", { likes: 40 }),
      post(6, "v"),
      post(7, "u"),
    ];
    expect(featuredPosts(posts, now).map((p) => p.thread_id)).toEqual([
      "a",
      "y",
      "w",
      "x",
      "z",
    ]);
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

// ADR-042: the daily line, composed from the pack by rule.

import {
  dailyLine,
  freshestStaffWord,
  headlineCut,
  headlineTitle,
  shortBuild,
} from "../lib/front";

describe("dailyLine", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  const facts = {
    staffThread: {
      title:
        "[All Waves] Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes 13160301",
      publishedAt: "2026-11-10T20:00:00Z",
      reply: false,
    },
    dispatch: {
      title: "Twitch Drops: IAE 2956",
      publishedAt: "2026-11-09T21:00:00Z",
    },
    builds: { live: "4.10.2", ptu: "4.10.3" },
    funding: { year: 2026, yearToDate: "$132.1M", change: "+19.9%" },
  };

  it("leads with the newer of the staff thread and the dispatch, then the funding on an even day", () => {
    expect(dailyLine(facts, now, 20768)).toBe(
      "CIG posted “Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes” on Spectrum 4 h ago, and $132.1M pledged in 2026, +19.9% on 2025.",
    );
  });

  it("takes the builds on an odd day, and the dispatch when it is newer or the thread is missing", () => {
    expect(dailyLine(facts, now, 20769)).toBe(
      "CIG posted “Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes” on Spectrum 4 h ago, and Alpha 4.10.2 is live and 4.10.3 is on the PTU.",
    );
    const newer = {
      ...facts,
      dispatch: { ...facts.dispatch, publishedAt: "2026-11-10T23:50:00Z" },
    };
    expect(dailyLine(newer, now, 20769)).toMatch(
      /^The latest dispatch is “Twitch Drops: IAE 2956”, 10 min ago, and Alpha/,
    );
    expect(dailyLine({ ...facts, staffThread: null }, now, 20768)).toMatch(
      /^The latest dispatch is “Twitch Drops: IAE 2956”, 1 d ago, and \$132/,
    );
  });

  it("falls back across what the pack lacks, down to the site's own words", () => {
    expect(
      dailyLine(
        { ...facts, funding: null, builds: { live: "4.10.2", ptu: null } },
        now,
        20768,
      ),
    ).toBe(
      "CIG posted “Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes” on Spectrum 4 h ago, and Alpha 4.10.2 is live.",
    );
    expect(
      dailyLine({ ...facts, builds: { live: null, ptu: null } }, now, 20769),
    ).toMatch(/, and \$132\.1M pledged in 2026, \+19\.9% on 2025\.$/);
    expect(
      dailyLine(
        {
          staffThread: null,
          dispatch: null,
          builds: { live: null, ptu: null },
          funding: null,
        },
        now,
        1,
      ),
    ).toBe("Star Citizen, on record.");
    expect(
      dailyLine(
        {
          staffThread: null,
          dispatch: null,
          builds: { live: "4.10.2", ptu: null },
          funding: null,
        },
        now,
        1,
      ),
    ).toBe("Alpha 4.10.2 is live.");
  });

  it('says "posted in" when the freshest staff post answers a thread, and leaves a change out when unknown', () => {
    const reply = {
      ...facts,
      staffThread: { ...facts.staffThread, reply: true },
      funding: { year: 2027, yearToDate: "$412.3K", change: null },
    };
    expect(dailyLine(reply, now, 20768)).toBe(
      "CIG posted in “Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes” on Spectrum 4 h ago, and $412.3K pledged in 2027.",
    );
    // A week on, the cards' clock goes absolute, and so does the line's.
    expect(
      dailyLine(
        { ...facts, staffThread: null },
        new Date("2026-11-20T00:00:00Z"),
        20768,
      ),
    ).toMatch(
      /^The latest dispatch is “Twitch Drops: IAE 2956”, 9 Nov 2026, and/,
    );
  });

  it("cuts a long title on a word with an ellipsis", () => {
    const long =
      "Star Citizen Live: Q&A with the vehicle team on the Perseus, the Polaris and everything in between, part two";
    expect(headlineCut(long)).toBe(
      "Star Citizen Live: Q&A with the vehicle team on the Perseus, the Polaris and everything…",
    );
    expect(headlineCut("Short")).toBe("Short");
    expect(headlineCut("a".repeat(100))).toBe(`${"a".repeat(90)}…`);
  });

  it("trims a thread's title for a headline and shortens a build", () => {
    expect(
      headlineTitle(
        "[All Waves] Star Citizen Alpha 4.10.3 PTU Patch Notes 13145606",
      ),
    ).toBe("Star Citizen Alpha 4.10.3 PTU Patch Notes");
    expect(headlineTitle("IAE 2956 - Choose Your Adventure - FAQ")).toBe(
      "IAE 2956 - Choose Your Adventure - FAQ",
    );
    expect(headlineTitle("Pumpkin contest 2026")).toBe("Pumpkin contest 2026");
    // Only an audience tag is dropped; any other bracketed word is CIG's and stays.
    expect(headlineTitle("[Now Closed] Alpha 4.10 PTU Feedback")).toBe(
      "[Now Closed] Alpha 4.10 PTU Feedback",
    );
    expect(headlineTitle("[5.0 PTU Feedback] Planet Tech V5")).toBe(
      "[5.0 PTU Feedback] Planet Tech V5",
    );
    expect(
      headlineTitle("[Wave 1] Alpha 4.10.3 PTU Patch Notes 13130000"),
    ).toBe("Alpha 4.10.3 PTU Patch Notes");
    expect(shortBuild("4.10.2-LIVE.12881860")).toBe("4.10.2");
    expect(shortBuild(null)).toBeNull();
  });

  it("finds the freshest staff-opened thread's post within the window", () => {
    const post = (hoursAgo: number, thread: string, opener = false) => ({
      published_at: new Date(
        now.getTime() - hoursAgo * 3_600_000,
      ).toISOString(),
      thread_id: thread,
      url: opener
        ? `https://example.test/thread/${thread}`
        : `https://example.test/thread/${thread}/${hoursAgo}`,
    });
    const posts = [
      post(1, "answered"),
      post(3, "notes"),
      post(400, "notes", true),
      post(10, "faq", true),
    ];
    expect(freshestStaffWord(posts, now)?.thread_id).toBe("notes");
    expect(freshestStaffWord(posts, now, 2)).toBeNull();
    expect(freshestStaffWord([], now)).toBeNull();
  });
});
