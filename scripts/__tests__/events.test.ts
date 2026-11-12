import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EventRecord, eventOnFront, eventPhase, phaseKey } from "schema";
import { describe, expect, it } from "vitest";
import {
  type CommLinkMeta,
  type FaqPost,
  buildEvent,
  featuredOf,
  hallOf,
  openingOf,
  parseFaq,
  placeOf,
  yearFor,
} from "../events/build.js";
import {
  EventShapeError,
  bodyUrlOf,
  dayLabel,
  firstSentence,
  parseDayHtml,
  parseScheduleBody,
  plainText,
} from "../events/parse.js";
import { RSI_SPACING_MS, englishUrl, isDue, runEvents } from "../events/run.js";

// The parser runs on RSI's own pages as served on 2026-11-12 (the schedule Comm-Link and its
// page-builder body) and the FAQ's third revision, committed in fixtures/events/samples; never on
// the network (CLAUDE.md section 6).

const here = dirname(fileURLToPath(import.meta.url));
const samples = join(here, "..", "..", "fixtures", "events", "samples");
const page = readFileSync(join(samples, "comm-link-21386.sample.html"), "utf8");
const bodyHtml = readFileSync(
  join(samples, "comm-link-21386-body.sample.html"),
  "utf8",
);
const items = JSON.parse(
  readFileSync(join(samples, "news-items.sample.json"), "utf8"),
) as { comm_link: CommLinkMeta; faq: FaqPost };
const SOURCE = {
  slug: "iae-2956",
  kind: "iae" as const,
  schedule_comm_link: "21386",
  faq_thread: "575984",
};
const BODY_URL =
  "https://robertsspaceindustries.com/alexandria/html/6ad1120ff662e74386db6f4b/6af49f40b153459bd9458f54/9PSi6rulraO8ATjcoJEUqSjZAL8-en-mwcd80r7-fa253c06";

const build = (faq: FaqPost | null = items.faq): EventRecord =>
  buildEvent({
    source: SOURCE,
    commLink: items.comm_link,
    bodyUrl: BODY_URL,
    body: parseScheduleBody(bodyHtml),
    faq,
    fetchedAt: new Date("2026-11-12T19:10:00.000Z"),
  });

describe("the transmission page", () => {
  it("names the page builder's body", () => {
    expect(bodyUrlOf(page)).toBe(BODY_URL);
  });

  it("halts on a page without one, or one off RSI", () => {
    expect(() => bodyUrlOf("<html></html>")).toThrow(EventShapeError);
    expect(() =>
      bodyUrlOf(
        "{&quot;htmlUrl&quot;:&quot;https:\\/\\/example.com\\/alexandria\\/html\\/x&quot;}",
      ),
    ).toThrow(/not RSI's page builder/);
  });

  it("is asked for in English, without the redirect", () => {
    expect(
      englishUrl(
        "https://robertsspaceindustries.com/comm-link/transmission/21386-X",
      ),
    ).toBe(
      "https://robertsspaceindustries.com/en/comm-link/transmission/21386-X",
    );
    expect(englishUrl("https://robertsspaceindustries.com/en/x")).toBe(
      "https://robertsspaceindustries.com/en/x",
    );
  });
});

describe("the schedule's body", () => {
  const body = parseScheduleBody(bodyHtml);

  it("reads the banner, the introduction and every entry", () => {
    expect(body.title).toBe("Intergalactic Aerospace Expo 2956");
    expect(body.subtitle).toBe("Free Fly & Manufacturer Schedule");
    expect(body.picture?.alt).toBe("SC IAE2026 COMMUNITYHUB");
    expect(body.intro.length).toBeGreaterThan(3);
    expect(body.entries.map((e) => e.title)).toEqual([
      "Roberts Space Industries",
      "Origin Jumpworks",
      "Anvil Aerospace",
      "Crusader Industries, Tumbril",
      "Drake Interplanetary",
      "ARGO Astronautics, Consolidated Outland, Greycat Industrial, Grey's Market",
      "MISC, Mirai, Kruger Intergalactic",
      "Aegis Dynamics",
      "Aopoa, Banu, Esperia, Gatac",
      "Best In Show",
      "Finale",
      "Pre-Flight Check",
    ]);
  });

  it("gives each day the banner before it, and the finale its own picture", () => {
    expect(body.entries[0]?.picture?.alt).toBe("Galaxy2026");
    expect(body.entries[9]?.picture?.alt).toBe("Perseus2026");
    expect(body.entries[10]?.picture?.url).toMatch(
      /^https:\/\/robertsspaceindustries\.com\/i\//,
    );
  });

  it("halts on a component it does not know", () => {
    expect(() =>
      parseScheduleBody(`${bodyHtml}<g-carousel :x="1"></g-carousel>`),
    ).toThrow(/unknown component <g-carousel>/);
  });

  it("halts without an opening banner", () => {
    expect(() => parseScheduleBody("<g-features></g-features>")).toThrow(
      EventShapeError,
    );
  });
});

describe("a day's text", () => {
  it("reads the label of one day, a run of days and a month's turn", () => {
    expect(dayLabel("Day 1, November 13-14")).toEqual({
      first: 1,
      last: 1,
      from: { month: 11, day: 13 },
      to: { month: 11, day: 14 },
    });
    expect(dayLabel("Day 10, November 22")?.to).toEqual({
      month: 11,
      day: 22,
    });
    expect(dayLabel("Day 11-15, November 23-27")).toMatchObject({
      first: 11,
      last: 15,
    });
    expect(dayLabel("Day 3, November 30 - December 1")?.to).toEqual({
      month: 12,
      day: 1,
    });
    expect(dayLabel("Pre-Flight Check")).toBeNull();
    expect(() => dayLabel("Day 2, Soon")).toThrow(EventShapeError);
  });

  it("reads the maker headings and the ship lines of a shared day", () => {
    const day = parseDayHtml(
      '<p>Lead one. Lead two.</p><p><strong>CRUSADER INDUSTRIES</strong></p><ul><li><a href="https://robertsspaceindustries.com/pledge/ships/spirit/A1-Spirit"><strong>Crusader A1 Spirit</strong></a>&#160;- A bomber. More text.</li></ul><p><strong>TUMBRIL</strong></p><ul><li><strong>Tumbril Nova</strong></li></ul>',
      "test",
    );
    expect(day.lead).toBe("Lead one.");
    expect(day.groups).toEqual(["CRUSADER INDUSTRIES", "TUMBRIL"]);
    expect(day.ships).toEqual([
      {
        name: "Crusader A1 Spirit",
        url: "https://robertsspaceindustries.com/pledge/ships/spirit/A1-Spirit",
        line: "A bomber.",
        group: "CRUSADER INDUSTRIES",
      },
      { name: "Tumbril Nova", url: null, line: null, group: "TUMBRIL" },
    ]);
  });

  it("halts on a list line with no name", () => {
    expect(() => parseDayHtml("<ul><li>just words</li></ul>", "t")).toThrow(
      /no name/,
    );
  });

  it("quotes briefly: the first sentence, cut at a word when long", () => {
    expect(firstSentence("One thing. Two things.")).toBe("One thing.");
    expect(firstSentence("Is it? Yes.")).toBe("Is it?");
    const long = `${"word ".repeat(80)}end.`;
    expect(firstSentence(long).length).toBeLessThanOrEqual(241);
    expect(firstSentence(long).endsWith("…")).toBe(true);
  });

  it("folds the editor's spaces", () => {
    expect(plainText("a&nbsp;<b>b</b>​ c")).toBe("a b c");
  });
});

describe("the event record", () => {
  const event = build();

  it("validates and holds RSI's dates, place and days", () => {
    expect(EventRecord.safeParse(event).success).toBe(true);
    expect(event.title).toBe("Intergalactic Aerospace Expo 2956");
    expect(event.opens_at).toBe("2026-11-13T16:00:00.000Z");
    expect(event.last_day).toBe("2026-11-27");
    expect(event.venue).toEqual({
      place: "Tobin Expo Center",
      city: "New Babbage",
      body: "microTech",
      system: "Stanton",
    });
    expect(event.days).toHaveLength(11);
    expect(event.days.reduce((n, d) => n + d.ships.length, 0)).toBe(192);
  });

  it("opens each day at the show's hour and keeps the finale inside its last day", () => {
    expect(event.days[0]).toMatchObject({
      from: "2026-11-13",
      to: "2026-11-14",
      opens_at: "2026-11-13T16:00:00.000Z",
      closes_at: "2026-11-14T16:00:00.000Z",
    });
    expect(event.days[9]).toMatchObject({
      title: "Best In Show",
      from: "2026-11-22",
      to: "2026-11-22",
      closes_at: "2026-11-23T16:00:00.000Z",
    });
    expect(event.days[10]).toMatchObject({
      first: 11,
      last: 15,
      opens_at: "2026-11-23T16:00:00.000Z",
      closes_at: "2026-11-28T00:00:00.000Z",
    });
  });

  it("names each day's makers and the ship its banner shows", () => {
    expect(event.days[3]?.makers).toEqual([
      "CRUSADER INDUSTRIES",
      "TUMBRIL LAND SYSTEMS",
    ]);
    expect(event.days[0]?.makers).toEqual(["Roberts Space Industries"]);
    expect(event.days[9]?.makers).toEqual([]);
    expect(event.days.map((d) => d.featured)).toEqual([
      "RSI Galaxy",
      "Origin M80",
      "Anvil Carrack",
      "Crusader A2 Hercules",
      "Drake Ironclad",
      "Grey's Market Basher",
      "Kruger S-65 Stingray",
      "Aegis Tiburon",
      "Gatac Railen",
      "RSI Perseus",
      null,
    ]);
  });

  it("reads the FAQ's sale: six waves and the hulls by day", () => {
    expect(event.sales?.waves.map((w) => [w.at, w.next_day])).toEqual([
      ["16:00", false],
      ["20:00", false],
      ["00:00", false],
      ["04:00", true],
      ["08:00", true],
      ["12:00", true],
    ]);
    expect(event.sales?.hulls).toEqual([
      { name: "Origin 890 Jump", from: "2026-11-14", day: 2 },
      { name: "Drake Kraken", from: "2026-11-17", day: 5 },
      { name: "Drake Kraken Privateer", from: "2026-11-17", day: 5 },
      { name: "Consolidated Outland Pioneer", from: "2026-11-18", day: 6 },
      { name: "Aegis Idris-P", from: "2026-11-20", day: 8 },
      { name: "Aegis Javelin", from: "2026-11-20", day: 8 },
    ]);
    expect(event.sales?.notes).toEqual([
      "The price of the MISC Prospector will increase by $20, from $155 to $175 on MISC Day of IAE.",
    ]);
    expect(event.sources.map((s) => s.kind)).toEqual(["comm_link", "spectrum"]);
  });

  it("stands without the FAQ: no sale, the place from the schedule", () => {
    const bare = build(null);
    expect(bare.sales).toBeNull();
    expect(bare.venue.place).toBe("Tobin Expo Center");
    expect(bare.sources).toHaveLength(1);
  });
});

describe("the pieces of the record", () => {
  it("reads the year RSI means", () => {
    const nov = new Date("2026-11-09T00:00:00Z");
    expect(yearFor({ month: 11, day: 13 }, nov)).toBe(2026);
    expect(yearFor({ month: 1, day: 3 }, nov)).toBe(2027);
    expect(yearFor({ month: 12, day: 1 }, new Date("2027-01-02Z"))).toBe(2026);
  });

  it("finds the opening hour, the place and the hall", () => {
    expect(openingOf(["It lands on November 13, 16:00 UTC."])).toEqual({
      md: { month: 11, day: 13 },
      hour: 16,
      minute: 0,
    });
    expect(openingOf(["from November 13 at 16:00 UTC"])?.hour).toBe(16);
    expect(openingOf(["no time here"])).toBeNull();
    expect(
      placeOf(["Join us in New Babbage on microTech, system Stanton, for"]),
    ).toEqual({ city: "New Babbage", body: "microTech", system: "Stanton" });
    expect(
      hallOf([
        "kiosks located at the Tobin Expo Center.",
        "kiosks located in the Tobin Center in",
        "held at the Tobin Expo Center in New Babbage",
      ]),
    ).toBe("Tobin Expo Center");
  });

  it("matches a banner to its ship by RSI's picture name", () => {
    const ships = [{ name: "Origin 100i" }, { name: "Origin M80" }];
    expect(featuredOf({ url: "https://x/i/a", alt: "M80" }, ships)).toBe(
      "Origin M80",
    );
    expect(
      featuredOf(
        { url: "https://x/i/a", alt: "SC IAE2026 COMMUNITYHUB" },
        ships,
      ),
    ).toBeNull();
    expect(featuredOf(null, ships)).toBeNull();
  });

  it("halts on a FAQ that lists waves it cannot read", () => {
    const faq = { ...items.faq, body_html: "<p>▲ Wave 1 at four o'clock</p>" };
    expect(() => parseFaq(faq, new Date(faq.published_at))).toThrow(
      EventShapeError,
    );
    const half = {
      ...items.faq,
      body_html: "<p>▲ Wave 1 - 16:00 UTC</p><p>stock-limited ships</p>",
    };
    expect(() => parseFaq(half, new Date(half.published_at))).toThrow(
      /without both/,
    );
    const none = { ...items.faq, body_html: "<p>Nothing on sale.</p>" };
    expect(parseFaq(none, new Date(none.published_at))).toBeNull();
  });
});

describe("where the show stands", () => {
  const event = build();
  const at = (iso: string) => eventPhase(event, new Date(iso));

  it("moves from before to opening, through the days, to after", () => {
    expect(at("2026-11-12T23:59:00Z")).toEqual({ kind: "before" });
    expect(at("2026-11-13T00:00:00Z")).toEqual({ kind: "opening" });
    expect(at("2026-11-13T16:00:00Z")).toEqual({ kind: "day", index: 0 });
    expect(at("2026-11-15T18:00:00Z")).toEqual({ kind: "day", index: 2 });
    expect(at("2026-11-22T17:00:00Z")).toEqual({ kind: "day", index: 9 });
    expect(at("2026-11-27T23:59:00Z")).toEqual({ kind: "day", index: 10 });
    expect(at("2026-11-28T00:00:00Z")).toEqual({ kind: "after" });
  });

  it("is on the front page from the day it opens to the end of its last day", () => {
    const on = (iso: string) => eventOnFront(event, new Date(iso));
    expect(on("2026-11-12T23:59:00Z")).toBe(false);
    expect(on("2026-11-13T08:00:00Z")).toBe(true);
    expect(on("2026-11-27T23:59:00Z")).toBe(true);
    expect(on("2026-11-28T00:00:00Z")).toBe(false);
  });

  it("names each phase in one word for the state file", () => {
    const key = (iso: string) =>
      phaseKey(event, eventPhase(event, new Date(iso)));
    expect(key("2026-11-12T12:00:00Z")).toBe("before");
    expect(key("2026-11-13T12:00:00Z")).toBe("opening");
    expect(key("2026-11-14T17:00:00Z")).toBe("day-2");
    expect(key("2026-11-24T17:00:00Z")).toBe("day-11");
    expect(key("2026-11-28T01:00:00Z")).toBe("after");
  });
});

describe("a run of the step", () => {
  const event = build();
  const seen = (phase: string) => ({
    phase,
    body_url: BODY_URL,
    read_at: "2026-11-12T19:10:00.000Z",
  });

  it("reads RSI when an event is new, its day has turned, or it is forced", () => {
    const t = new Date("2026-11-14T17:00:00Z");
    expect(isDue(undefined, undefined, t, false)).toBe(true);
    expect(isDue(event, seen("day-1"), t, false)).toBe(true);
    expect(isDue(event, seen("day-2"), t, false)).toBe(false);
    expect(isDue(event, seen("day-2"), t, true)).toBe(true);
    expect(
      isDue(event, seen("after"), new Date("2026-12-01T00:00:00Z"), false),
    ).toBe(false);
  });

  const news = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      source: "comm_link" as const,
      external_id: "21386",
      url: items.comm_link.url,
      title: items.comm_link.title,
      summary: null,
      body_html: "",
      published_at: items.comm_link.published_at,
      fetched_at: "2026-11-10T00:00:00.000Z",
      revision: 1,
      author_id: null,
      thread_id: null,
      thread_title: null,
      forum: null,
      takedown: false,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      source: "spectrum" as const,
      external_id: "575984",
      url: items.faq.url,
      title: items.faq.title,
      summary: null,
      body_html: items.faq.body_html,
      published_at: items.faq.published_at,
      fetched_at: "2026-11-11T00:00:00.000Z",
      revision: items.faq.revision,
      author_id: null,
      thread_id: "575984",
      thread_title: items.faq.title,
      forum: null,
      takedown: false,
    },
  ];

  it("asks RSI twice, spaced, with the project's agent, and records the phase", async () => {
    const calls: { url: string; agent: string | undefined }[] = [];
    const sleeps: number[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({
        url,
        agent: (init.headers as Record<string, string>)["User-Agent"],
      });
      return new Response(url.includes("/alexandria/") ? bodyHtml : page, {
        status: 200,
      });
    }) as typeof fetch;
    const out = await runEvents(
      { registry: [SOURCE], news, records: new Map(), state: {}, force: false },
      {
        fetch: fake,
        sleep: async (ms) => sleeps.push(ms),
        now: () => new Date("2026-11-14T17:00:00Z"),
        userAgent: "Coppercork/1.0 (+https://coppercork.com/about; x) events",
        log: () => {},
      },
    );
    expect(calls.map((c) => c.url)).toEqual([
      englishUrl(items.comm_link.url),
      BODY_URL,
    ]);
    expect(calls.every((c) => c.agent?.startsWith("Coppercork/"))).toBe(true);
    expect(sleeps).toEqual([RSI_SPACING_MS, RSI_SPACING_MS]);
    expect(out.requests).toBe(2);
    expect(out.state["iae-2956"]?.phase).toBe("day-2");
    expect(out.records.get("iae-2956")?.days).toHaveLength(11);
  });

  it("asks RSI nothing when not due, and reads the FAQ's sale again", async () => {
    let asked = 0;
    const fake = (async () => {
      asked += 1;
      return new Response("", { status: 500 });
    }) as typeof fetch;
    const stale = { ...event, sales: null };
    const out = await runEvents(
      {
        registry: [SOURCE],
        news,
        records: new Map([["iae-2956", stale]]),
        state: { "iae-2956": seen("day-2") },
        force: false,
      },
      {
        fetch: fake,
        sleep: async () => {},
        now: () => new Date("2026-11-14T17:00:00Z"),
        userAgent: "x",
        log: () => {},
      },
    );
    expect(asked).toBe(0);
    expect(out.records.get("iae-2956")?.sales?.hulls).toHaveLength(6);
  });

  it("halts on an answer that is not 200, writing nothing", async () => {
    const fake = (async () =>
      new Response("", { status: 503 })) as typeof fetch;
    await expect(
      runEvents(
        {
          registry: [SOURCE],
          news,
          records: new Map(),
          state: {},
          force: false,
        },
        {
          fetch: fake,
          sleep: async () => {},
          now: () => new Date("2026-11-14T17:00:00Z"),
          userAgent: "x",
          log: () => {},
        },
      ),
    ).rejects.toThrow(/503/);
  });

  it("waits for a Comm-Link the news pack has not got", async () => {
    const out = await runEvents(
      {
        registry: [SOURCE],
        news: [],
        records: new Map(),
        state: {},
        force: false,
      },
      {
        fetch: (async () => {
          throw new Error("no request expected");
        }) as typeof fetch,
        sleep: async () => {},
        now: () => new Date(),
        userAgent: "x",
        log: () => {},
      },
    );
    expect(out.requests).toBe(0);
    expect(out.records.size).toBe(0);
  });
});
