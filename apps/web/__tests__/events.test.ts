import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventRecord } from "schema";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, repo } from "../lib/data";
import {
  dayCount,
  dayLabel,
  dayStatuses,
  eventMaker,
  eventNews,
  events,
  formatDayRange,
  frontEvent,
  leadDay,
  pageKey,
  shipResolver,
  shortTitle,
  waveMoments,
} from "../lib/events";

// ADR-057: the events module on IAE 2956 as RSI's saved pages build it (the frozen record the
// fetcher's tests keep equal to their build), never the live record, which the News workflow
// rewrites as RSI edits its page; and the register on file, which the daily refresh rewrites, so
// what is checked against it is what holds whatever it says.

const frozen = EventRecord.parse(
  JSON.parse(
    readFileSync(
      join(REPO_ROOT, "fixtures", "events", "samples", "iae-2956.record.json"),
      "utf8",
    ),
  ),
);
const iae = () => frozen;

describe("the events on file", () => {
  it("loads every event in the registry, validated, the latest first", () => {
    const list = events();
    expect(list.every((e) => EventRecord.safeParse(e).success)).toBe(true);
    const opens = list.map((e) => e.opens_at);
    expect([...opens].sort().reverse()).toEqual(opens);
  });

  it("puts a show on the front page from its eve to the end of its last day", () => {
    const list = [iae()];
    expect(frontEvent(new Date("2026-11-11T12:00:00Z"), list)).toBeNull();
    // The day before it opens, the hero already says so.
    expect(frontEvent(new Date("2026-11-12T12:00:00Z"), list)?.slug).toBe(
      "iae-2956",
    );
    expect(frontEvent(new Date("2026-11-13T09:00:00Z"), list)?.slug).toBe(
      "iae-2956",
    );
    expect(frontEvent(new Date("2026-11-27T23:00:00Z"), list)?.slug).toBe(
      "iae-2956",
    );
    // The day after it ends, gone.
    expect(frontEvent(new Date("2026-11-28T00:00:00Z"), list)).toBeNull();
  });
});

describe("words and dates", () => {
  it("shortens the show's name the way CIG does", () => {
    expect(shortTitle(iae())).toBe("IAE 2956");
    expect(shortTitle({ kind: "other", title: "Some Show 2957" })).toBe(
      "Some Show 2957",
    );
    expect(
      shortTitle({ kind: "invictus", title: "Invictus Launch Week 2957" }),
    ).toBe("Invictus 2957");
  });

  it("writes day ranges in the site's style", () => {
    expect(formatDayRange("2026-11-13", "2026-11-14")).toBe("13–14 November");
    expect(formatDayRange("2026-11-22", "2026-11-22")).toBe("22 November");
    expect(formatDayRange("2026-11-30", "2026-12-01")).toBe(
      "30 November – 1 December",
    );
    expect(formatDayRange("2026-11-13", "2026-11-27", true)).toBe(
      "13–27 November 2026",
    );
    expect(dayLabel({ first: 3, last: 3 })).toBe("Day 3");
    expect(dayLabel({ first: 11, last: 15 })).toBe("Days 11–15");
    expect(dayCount(iae())).toBe(15);
  });
});

describe("the days at a moment", () => {
  it("marks the day on now, the next, and the ones over", () => {
    const s = dayStatuses(iae(), new Date("2026-11-15T18:00:00Z"));
    expect(s.slice(0, 5)).toEqual(["past", "past", "now", "next", "later"]);
    expect(leadDay(iae(), new Date("2026-11-15T18:00:00Z"))?.title).toBe(
      "Anvil Aerospace",
    );
  });

  it("leads with the first day before the doors open, and with none once it is over", () => {
    const before = dayStatuses(iae(), new Date("2026-11-13T10:00:00Z"));
    expect(before[0]).toBe("next");
    expect(leadDay(iae(), new Date("2026-11-13T10:00:00Z"))?.first).toBe(1);
    expect(leadDay(iae(), new Date("2026-11-29T00:00:00Z"))).toBeNull();
    expect(
      dayStatuses(iae(), new Date("2026-11-29T00:00:00Z")).every(
        (d) => d === "past",
      ),
    ).toBe(true);
  });
});

describe("the sale's waves", () => {
  it("places each wave the first time its hour comes round after the last", () => {
    const sales = iae().sales!;
    expect(waveMoments(sales, { from: "2026-11-14" })).toEqual([
      "2026-11-14T16:00:00.000Z",
      "2026-11-14T20:00:00.000Z",
      "2026-11-15T00:00:00.000Z",
      "2026-11-15T04:00:00.000Z",
      "2026-11-15T08:00:00.000Z",
      "2026-11-15T12:00:00.000Z",
    ]);
  });
});

describe("the makers and ships against the register", () => {
  const r = repo();

  it("names RSI's makers as the register does", () => {
    const m = (raw: string) => eventMaker(raw, r.manufacturers);
    expect(m("Roberts Space Industries").manufacturer?.code).toBe("RSI");
    expect(
      m("MUSASHI INDUSTRIAL AND STARFLIGHT CONCERN").manufacturer?.code,
    ).toBe("MISC");
    expect(m("GATAC MANUFACTURE").manufacturer).not.toBeNull();
    // A maker the register lacks keeps RSI's name, set as a name.
    expect(eventMaker("SOME NEW MAKER", []).name).toBe("Some New Maker");
  });

  const label = (slug: string): string | null => {
    const ship = r.shipBySlug(slug);
    if (ship !== undefined) {
      return (
        {
          flight_ready: "Flight ready",
          in_production: "In production",
          concept: "In concept",
        }[ship.vehicle.status] ?? null
      );
    }
    return "In concept";
  };

  it("finds the schedule's ships in the register, never a display copy, with the register's status", () => {
    const resolve = shipResolver(r);
    const views = iae().days.flatMap((d) => d.ships.map(resolve));
    expect(views).toHaveLength(192);
    // New reveals may be missing from the register for a day; nearly all are there.
    expect(views.filter((v) => v.slug !== null).length).toBeGreaterThanOrEqual(
      180,
    );
    expect(views.some((v) => v.slug?.endsWith("-display"))).toBe(false);
    for (const v of views) {
      if (v.slug !== null) expect(v.status, v.name).toBe(label(v.slug));
      else
        expect(v.href ?? "").toMatch(
          /^https:\/\/robertsspaceindustries\.com\//,
        );
    }
    // Slugs never change once published (CLAUDE.md section 5).
    const by = (name: string) => views.find((v) => v.name === name);
    expect(by("RSI Constellation Mk V Centaurus")?.slug).toBe(
      "rsi-constellation-mk5-centaurus",
    );
    expect(by("RSI Aurora Mk II")?.href).toBe("/ships/aurora-mk-ii");
  });

  it("finds the limited hulls by name, and only under their own maker", () => {
    const resolve = shipResolver(r);
    const hull = (name: string) =>
      resolve({ name, pledge_url: null, line: null, group: null });
    expect(hull("Origin 890 Jump").slug).toBe("890-jump");
    expect(hull("Drake Kraken").slug).toBe("kraken");
    expect(hull("Aegis Javelin").slug).toBe("javelin");
    // The Aurora is RSI's: another maker's name in front is not it.
    expect(hull("Aegis Aurora Mk II").slug).toBeNull();
  });

  it("keys RSI's pages without the language and the case", () => {
    expect(
      pageKey(
        "https://robertsspaceindustries.com/en/pledge/ships/galaxy/Galaxy",
      ),
    ).toBe("/pledge/ships/galaxy/galaxy");
    expect(
      pageKey("https://robertsspaceindustries.com/pledge/ships/galaxy/Galaxy/"),
    ).toBe("/pledge/ships/galaxy/galaxy");
  });
});

describe("the dispatches about a show", () => {
  it("takes the Comm-Links and videos that name it, newest first", () => {
    const news = eventNews(iae(), repo().dispatches);
    const ids = news.map((n) => n.external_id);
    expect(ids).toContain("21386");
    expect(ids).toContain("21389");
    expect(
      news.every((n) => n.source === "comm_link" || n.source === "video"),
    ).toBe(true);
    const times = news.map((n) => n.published_at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
