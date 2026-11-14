import type { FundingSnapshot } from "schema";
import { describe, expect, it } from "vitest";
import {
  type Reading,
  formatChange,
  formatCompact,
  formatReadAt,
  formatShortDay,
  headline,
  loadCounter,
  loadFunding,
  readingAt,
  readings,
  sameDaysChange,
  sameMomentChange,
  sameDayPriorYear,
  withCounter,
  yearOnYear,
  yearPaths,
  yearRows,
} from "../lib/funding";

// ADR-018, ADR-040: the funding figures, on the committed fixture and on small synthetic series.

const series = loadFunding();
if (series === null)
  throw new Error("fixtures/funding/Funding.json is missing");
const pledges = readings(series, "pledges");

/** One reading a day, `value` growing by `perDay`, from `from` for `days` days, with `skip` days missing. */
function synthetic(
  from: string,
  days: number,
  perDay: number,
  skip: readonly string[] = [],
): Reading[] {
  const start = Date.parse(from);
  const out: Reading[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    if (!skip.includes(day)) out.push({ day, value: 1000 + i * perDay });
  }
  return out;
}

describe("the fixture", () => {
  it("is ascending, starts in November 2012 and records the long gap", () => {
    expect(series.snapshots[0]?.day).toBe("2012-11-13");
    expect(series.snapshots[0]?.citizens).toBeNull();
    expect(series.source.gaps[0]).toMatchObject({
      from: "2022-01-25",
      to: "2024-05-08",
      days: 835,
    });
    const citizens = readings(series, "citizens");
    expect(citizens[0]?.day).toBe("2013-08-19");
    expect(citizens.length).toBeLessThan(pledges.length);
  });
});

describe("yearRows", () => {
  it("reports complete years and marks the current one partial", () => {
    const rows = yearRows(pledges);
    expect(rows[0]?.year).toBe(2012);
    expect(rows.at(-1)?.partial).toBe(true);
    const y2021 = rows.find((r) => r.year === 2021);
    expect(y2021?.total).toBeGreaterThan(80e6);
    expect(y2021?.months.every((m) => m !== null)).toBe(true);
    expect(y2021?.change).toBeGreaterThan(0);
  });

  it("leaves years and months inside the gap unknown rather than estimating", () => {
    const rows = yearRows(pledges);
    const y2023 = rows.find((r) => r.year === 2023);
    expect(y2023?.total).toBeNull();
    expect(y2023?.months.every((m) => m === null)).toBe(true);
    const y2022 = rows.find((r) => r.year === 2022);
    expect(y2022?.months[0]).toBeNull();
    const y2024 = rows.find((r) => r.year === 2024);
    expect(y2024?.total).toBeNull();
    expect(y2024?.months[5]).not.toBeNull();
    expect(y2024?.change).toBeNull();
  });

  it("sums months to the year on a synthetic series", () => {
    const list = synthetic("2019-12-31", 400, 10);
    const rows = yearRows(list);
    const y2020 = rows.find((r) => r.year === 2020);
    expect(y2020?.total).toBe(366 * 10);
    expect(y2020?.months.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)).toBe(
      366 * 10,
    );
    expect(y2020?.months[1]).toBe(29 * 10);
    expect(y2020?.change).toBeNull();
  });

  it("counts a leap year's 366 days and places 31 December at day 366", () => {
    const list = synthetic("2023-12-31", 400, 10);
    expect(yearRows(list).find((r) => r.year === 2024)?.total).toBe(366 * 10);
    const path = yearPaths(list, [2024])[0];
    expect(path?.points.at(-1)?.doy).toBe(366);
    expect(path?.points.find((p) => p.doy === 60)?.value).toBe(60 * 10);
  });

  it("tolerates a snapshot exactly three days before a period's end", () => {
    const list = synthetic("2019-12-31", 400, 10, [
      "2020-03-31",
      "2020-03-30",
      "2020-03-29",
    ]);
    expect(yearRows(list).find((r) => r.year === 2020)?.months[2]).toBe(
      31 * 10 - 30,
    );
  });

  it("tolerates a snapshot up to three days before a period's end, not four", () => {
    const ok = synthetic("2019-12-31", 400, 10, ["2020-03-31", "2020-03-30"]);
    expect(yearRows(ok).find((r) => r.year === 2020)?.months[2]).toBe(
      31 * 10 - 20,
    );
    const missing = synthetic("2019-12-31", 400, 10, [
      "2020-03-31",
      "2020-03-30",
      "2020-03-29",
      "2020-03-28",
    ]);
    expect(
      yearRows(missing).find((r) => r.year === 2020)?.months[2],
    ).toBeNull();
    expect(
      yearRows(missing).find((r) => r.year === 2020)?.months[3],
    ).toBeNull();
  });
});

describe("headline", () => {
  it("compares this year to the same days of last year and the trailing years", () => {
    const list = synthetic("2023-12-31", 500, 10);
    const h = headline(list);
    expect(h?.latest.day).toBe("2025-05-13");
    expect(h?.yearToDate).toBe(133 * 10);
    expect(h?.lastYearToSameDay).toBe(134 * 10);
    expect(h?.yearToDateChange).toBeCloseTo(133 / 134 - 1);
    expect(h?.trailing).toBe(3650);
    expect(h?.trailingChange).toBeNull();
    expect(h?.last30).toBe(300);
  });

  it("gives real figures on the fixture", () => {
    const h = headline(pledges);
    expect(h?.latest.value).toBeGreaterThan(1e9);
    expect(h?.yearToDate).toBeGreaterThan(1e8);
    expect(h?.trailingChange).not.toBeNull();
  });
});

describe("yearPaths", () => {
  it("builds a path per year with a baseline and skips years without one", () => {
    const paths = yearPaths(pledges, [2026, 2025, 2023]);
    expect(paths.map((p) => p.year)).toEqual([2026, 2025]);
    expect(paths[1]?.points.at(-1)?.doy).toBe(365);
    expect(paths[0]?.points[0]?.value).toBeGreaterThan(0);
  });
});

describe("readings at a day and formatting", () => {
  it("lists readings at a day, none inside the long gap", () => {
    expect(readingAt(pledges, "2023-01-01")).toBeNull();
    expect(readingAt(pledges, "2021-12-31")?.day).toBe("2021-12-31");
  });

  it("compares to the same calendar date a year earlier, 29 February included", () => {
    expect(sameDayPriorYear("2026-11-08")).toBe("2025-11-08");
    expect(sameDayPriorYear("2028-02-29")).toBe("2027-02-28");
    expect(sameDayPriorYear("2025-03-01")).toBe("2024-03-01");
  });

  it("formats compact values and signed changes", () => {
    expect(formatCompact(131_708_150, "pledges")).toBe("$131.7M");
    expect(formatCompact(6_753_476, "citizens")).toBe("6.8M");
    expect(formatChange(0.1994)).toBe("+19.9%");
    expect(formatChange(-0.15)).toBe("-15%");
    expect(formatChange(0)).toBe("0%");
  });
});

// ADR-038: the front page's funding card, this year against last year and month by month.

import { formatShare, monthPairs, yearAgainstLastYear } from "../lib/funding";

describe("yearAgainstLastYear", () => {
  it("reads the year so far, the share of last year's whole total and the same-days change", () => {
    // 10 a day through 2024 (a leap year, 3660), then 20 a day into 2025.
    const list = [
      ...synthetic("2023-12-31", 367, 10),
      ...synthetic("2025-01-01", 100, 20).map((r) => ({
        ...r,
        value: 1000 + 366 * 10 + (r.value - 1000) + 20,
      })),
    ];
    const a = yearAgainstLastYear(list);
    expect(a?.year).toBe(2025);
    expect(a?.lastYearTotal).toBe(3660);
    expect(a?.yearToDate).toBe(20 + 99 * 20);
    expect(a?.shareOfLastYear).toBeCloseTo((20 + 99 * 20) / 3660);
    // 10 April is day 101 of a leap year: last year had added 1010 by the same day.
    expect(a?.change).toBeCloseTo((20 + 99 * 20) / (101 * 10) - 1);
  });

  it("leaves the share unknown when last year's total is unknown, and gives real figures on the fixture", () => {
    // No reading within three days of 31 December: neither year is known at that end.
    const list = synthetic("2024-06-01", 300, 10, [
      "2024-12-28",
      "2024-12-29",
      "2024-12-30",
      "2024-12-31",
      "2025-01-01",
    ]);
    const a = yearAgainstLastYear(list);
    expect(a?.year).toBe(2025);
    expect(a?.yearToDate).toBeNull();
    expect(a?.lastYearTotal).toBeNull();
    expect(a?.shareOfLastYear).toBeNull();
    const real = yearAgainstLastYear(pledges);
    const latestDay = pledges.at(-1)!.day;
    expect(real?.year).toBe(Number(latestDay.slice(0, 4)));
    expect(real?.lastYearTotal).toBeGreaterThan(1e8);
    expect(real?.shareOfLastYear).toBeGreaterThan(0);
    expect(real?.change).not.toBeNull();
    expect(yearAgainstLastYear([])).toBeNull();
  });
});

describe("monthPairs", () => {
  it("pairs each month so far with last year's, marks the current one and the change", () => {
    const list = synthetic("2023-12-31", 366 + 75, 10);
    const rows = yearRows(list);
    const pairs = monthPairs(rows, list.at(-1)!.day);
    expect(pairs.map((p) => p.month)).toEqual([0, 1, 2]);
    expect(pairs[0]).toMatchObject({
      thisYear: 310,
      lastYear: 310,
      change: 0,
      current: false,
    });
    expect(pairs[1]).toMatchObject({ thisYear: 280, lastYear: 290 });
    expect(pairs[1]?.change).toBeCloseTo(280 / 290 - 1);
    expect(pairs[2]?.current).toBe(true);
    expect(pairs[2]?.thisYear).toBe(150);
    // A month that is not over is not read against a whole one.
    expect(pairs[2]?.change).toBeNull();
  });

  it("gives null where a month is unknown and nothing without two years", () => {
    const list = synthetic("2024-06-01", 300, 10);
    const rows = yearRows(list);
    const pairs = monthPairs(rows, list.at(-1)!.day);
    expect(pairs[0]?.lastYear).toBeNull();
    expect(pairs[0]?.change).toBeNull();
    expect(monthPairs(rows.slice(-1), list.at(-1)!.day)).toEqual([]);
    // On the fixture: one pair per month of the latest year up to the latest reading, the last
    // of them the current month, and at least one month compared with last year.
    const latestDay = pledges.at(-1)!.day;
    const real = monthPairs(yearRows(pledges), latestDay);
    expect(real).toHaveLength(Number(latestDay.slice(5, 7)));
    expect(real.at(-1)?.current).toBe(true);
    expect(real.at(-1)?.change).toBeNull();
    expect(real.some((p) => p.change !== null)).toBe(true);
  });

  it("formats a share as a whole percentage", () => {
    expect(formatShare(0.784)).toBe("78%");
    expect(formatShare(1.2)).toBe("120%");
  });
});

describe("citizens on the front page's card (ADR-040, amended 2026-11-11)", () => {
  it("draws this year against last and each month so far, from the fixture's citizens counter", () => {
    const citizens = readings(series, "citizens");
    const against = yearAgainstLastYear(citizens);
    expect(against).not.toBeNull();
    expect(against?.yearToDate).toBeGreaterThan(0);
    expect(against?.lastYearTotal).toBeGreaterThan(0);
    expect(against?.shareOfLastYear).not.toBeNull();
    const latestDay = citizens.at(-1)!.day;
    const pairs = monthPairs(yearRows(citizens), latestDay);
    expect(pairs).toHaveLength(Number(latestDay.slice(5, 7)));
    expect(pairs.some((p) => p.change !== null)).toBe(true);
  });
});

describe("RSI's own counter after the wiki's snapshots (ADR-018, amended 2026-11-13)", () => {
  const last = series.snapshots.at(-1)!;
  const reading = (iso: string, funds: number, citizens: number) => ({
    read_at: iso,
    funds_usd: funds,
    citizens,
  });
  const counterAt = (
    iso: string,
    funds: number,
    citizens: number,
    previous_day: ReturnType<typeof reading> | null = null,
  ) => ({
    source: {
      name: "RSI" as const,
      url: "https://robertsspaceindustries.com/api/stats/getCrowdfundStats",
      origin_url: "https://robertsspaceindustries.com/funding-goals",
    },
    ...reading(iso, funds, citizens),
    previous_day,
  });
  const dayAfter = (day: string, n = 1): string =>
    new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);
  const lastCitizens = last.citizens ?? 0;

  it("loads the committed reading", () => {
    const counter = loadCounter();
    expect(counter).not.toBeNull();
    expect(counter?.source.name).toBe("RSI");
  });

  it("stands as the next day's snapshot when read on the day after the wiki's last", () => {
    const day = dayAfter(last.day);
    const c = counterAt(
      `${day}T01:28:33.491Z`,
      last.funds_usd + 5000,
      lastCitizens + 7,
    );
    const { series: out, counter } = withCounter(series, c);
    expect(counter).toBe(c);
    expect(out.snapshots).toHaveLength(series.snapshots.length + 1);
    expect(out.snapshots.at(-1)).toEqual({
      day,
      recorded_at: c.read_at,
      funds_usd: c.funds_usd,
      citizens: c.citizens,
    });
    expect(headline(readings(out, "pledges"))?.latest).toEqual({
      day,
      value: c.funds_usd,
    });
    // The wiki's own series is left as it was.
    expect(series.snapshots.at(-1)).toBe(last);
  });

  it("takes the place of the wiki's snapshot of the same day when read later that day", () => {
    const c = counterAt(
      `${last.day}T23:30:00.000Z`,
      last.funds_usd + 10,
      lastCitizens,
    );
    const { series: out, counter } = withCounter(series, c);
    expect(counter).toBe(c);
    expect(out.snapshots).toHaveLength(series.snapshots.length);
    expect(out.snapshots.at(-1)?.recorded_at).toBe(c.read_at);
    expect(out.snapshots.at(-2)).toBe(series.snapshots.at(-2));
  });

  it("fills the day the wiki has recorded but the refresh has not copied with the earlier day's reading", () => {
    // Between midnight and the morning refresh: the wiki's copy ends two days before the reading.
    const missing = dayAfter(last.day);
    const today = dayAfter(last.day, 2);
    const evening = reading(
      `${missing}T23:37:00.000Z`,
      last.funds_usd + 900,
      lastCitizens + 3,
    );
    const c = counterAt(
      `${today}T00:07:00.000Z`,
      last.funds_usd + 950,
      lastCitizens + 4,
      evening,
    );
    const { series: out } = withCounter(series, c);
    expect(out.snapshots.map((s) => s.day).slice(-3)).toEqual([
      last.day,
      missing,
      today,
    ]);
    expect(out.snapshots.at(-2)?.recorded_at).toBe(evening.read_at);
    // A month that ends on the missing day closes on its own last day, not the one before.
    const pledgesOut = readings(out, "pledges");
    expect(readingAt(pledgesOut, missing)?.day).toBe(missing);
  });

  it("never puts the earlier day's reading in the place of a day the wiki has", () => {
    const today = dayAfter(last.day);
    const evening = reading(
      `${last.day}T23:37:00.000Z`,
      last.funds_usd + 900,
      lastCitizens + 3,
    );
    const c = counterAt(
      `${today}T00:07:00.000Z`,
      last.funds_usd + 950,
      lastCitizens + 4,
      evening,
    );
    const { series: out } = withCounter(series, c);
    expect(out.snapshots.at(-2)).toBe(last);
    expect(out.snapshots.at(-1)?.day).toBe(today);
  });

  it("is left out when the wiki's last snapshot is as new or newer, or when there is none", () => {
    const older = counterAt(last.recorded_at, last.funds_usd - 1, lastCitizens);
    expect(withCounter(series, older)).toEqual({ series, counter: null });
    expect(withCounter(series, null)).toEqual({ series, counter: null });
  });

  it("compares with last year on the wiki's snapshots alone, within one year", () => {
    const year = Number(last.day.slice(0, 4));
    const fromWiki = sameDaysChange(pledges, year);
    expect(fromWiki).toEqual({
      change: headline(pledges)?.yearToDateChange ?? null,
      to: last.day,
    });
    // The first hours of a year, before its first snapshot is copied: no comparison.
    expect(sameDaysChange(pledges, year + 1)).toBeNull();
  });

  it("formats a reading's time, long and short", () => {
    expect(formatReadAt("2026-11-14T01:28:33.491Z")).toBe(
      "14 November 2026, 01:28 UTC",
    );
    expect(formatReadAt("2026-11-14T01:28:33.491Z", true)).toBe(
      "14 Nov, 01:28 UTC",
    );
  });
});

describe("year on year against the same moment last year (ADR-018, amended 2026-11-13)", () => {
  const v = (day: string): number => {
    const s = series.snapshots.find((x) => x.day === day);
    if (s === undefined) throw new Error(`no snapshot on ${day}`);
    return s.funds_usd;
  };
  const at = (iso: string, funds: number, citizens = 6_760_000) => ({
    read_at: iso,
    funds_usd: funds,
    citizens,
  });
  const reading = at("2026-11-14T01:52:29.056Z", 1_064_815_395.65);

  it("compares with last year to the next daily reading after the same moment, so it never overstates", () => {
    // 01:52 on 14 November falls between last year's readings of the 13th and the 14th (20:00).
    const ytd = reading.funds_usd - v("2025-12-31");
    const expected = ytd / (v("2025-11-14") - v("2024-12-31")) - 1;
    expect(sameMomentChange(series, "pledges", reading)).toBeCloseTo(
      expected,
      12,
    );
    // Against the earlier reading it would be higher: the shown figure is the lower one.
    expect(ytd / (v("2025-11-13") - v("2024-12-31")) - 1).toBeGreaterThan(
      expected,
    );
    // After 20:00 the same moment falls between the 14th and the 15th.
    const evening = at("2026-11-14T21:00:00.000Z", 1_065_000_000);
    expect(sameMomentChange(series, "pledges", evening)).toBeCloseTo(
      (evening.funds_usd - v("2025-12-31")) /
        (v("2025-11-15") - v("2024-12-31")) -
        1,
      12,
    );
  });

  it("is not shown when a few hours would move it by more than five points, as in early January", () => {
    const january = at("2026-01-02T01:00:00.000Z", v("2025-12-31") + 1_000_000);
    expect(sameMomentChange(series, "pledges", january)).toBeNull();
  });

  it("works for citizens too, on the same readings", () => {
    const cit = (day: string): number => {
      const s = series.snapshots.find((x) => x.day === day);
      if (s?.citizens == null) throw new Error(`no citizens on ${day}`);
      return s.citizens;
    };
    const expected =
      (reading.citizens - cit("2025-12-31")) /
        (cit("2025-11-14") - cit("2024-12-31")) -
      1;
    expect(sameMomentChange(series, "citizens", reading)).toBeCloseTo(
      expected,
      12,
    );
  });

  it("is not shown when last year has no reading within a day either side", () => {
    // The wiki has no reading of 30 June 2025: 29 June to 1 July is 48 hours.
    const summer = at("2026-06-30T12:00:00.000Z", v("2025-12-31") + 70_000_000);
    expect(sameMomentChange(series, "pledges", summer)).toBeNull();
  });

  it("never overstates over a leap day: two years at the same pace compare at no more than zero", () => {
    // A synthetic pair of years, $1,000 a day at 20:00 UTC, 2027 and leap 2028.
    const snapshots: FundingSnapshot[] = [];
    for (
      let t = Date.parse("2026-12-25T20:00:00.000Z");
      t <= Date.parse("2028-12-31T20:00:00.000Z");
      t += 86_400_000
    ) {
      const iso = new Date(t).toISOString();
      const days = Math.round(
        (t - Date.parse("2026-12-25T20:00:00.000Z")) / 86_400_000,
      );
      snapshots.push({
        day: iso.slice(0, 10),
        recorded_at: iso,
        funds_usd: 1_000_000 + days * 1_000,
        citizens: 1_000 + days,
      });
    }
    const flat = { ...series, snapshots };
    const start2028 = snapshots.find((s) => s.day === "2027-12-31")!;
    for (const iso of [
      "2028-06-15T19:00:00.000Z",
      "2028-11-14T19:00:00.000Z",
    ]) {
      const hours =
        (Date.parse(iso) - Date.parse(start2028.recorded_at)) / 3_600_000;
      const counter = at(iso, start2028.funds_usd + (hours / 24) * 1_000);
      const change = sameMomentChange(flat, "pledges", counter);
      expect(change).not.toBeNull();
      expect(change!).toBeLessThanOrEqual(0);
      expect(change!).toBeGreaterThan(-0.01);
    }
  });

  it("falls back to the wiki's comparison, with the day it runs to, and uses the wiki's when there is no counter", () => {
    const last = series.snapshots.at(-1)!;
    const wiki = headline(readings(series, "pledges"))!;
    expect(yearOnYear(series, "pledges", null)).toEqual({
      change: wiki.yearToDateChange,
      to: null,
    });
    const current = yearOnYear(series, "pledges", reading);
    expect(current.to).toBeNull();
    expect(current.change).toBe(sameMomentChange(series, "pledges", reading));
    // A moment whose comparison cannot be shown (early January): the wiki's, to its last day, in
    // the same year as the reading.
    const year = Number(last.day.slice(0, 4));
    const unshowable = at(
      `${year}-01-02T01:00:00.000Z`,
      v(`${year - 1}-12-31`) + 1_000_000,
    );
    expect(sameMomentChange(series, "pledges", unshowable)).toBeNull();
    expect(yearOnYear(series, "pledges", unshowable)).toEqual({
      change: wiki.yearToDateChange,
      to: last.day,
    });
    // In another year than the wiki's last day: nothing to show.
    const nextYear = at(`${year + 1}-01-01T00:07:00.000Z`, last.funds_usd + 1);
    expect(yearOnYear(series, "pledges", nextYear)).toEqual({
      change: null,
      to: null,
    });
  });

  it("formats a short day", () => {
    expect(formatShortDay("2026-11-12")).toBe("12 Nov");
  });
});
