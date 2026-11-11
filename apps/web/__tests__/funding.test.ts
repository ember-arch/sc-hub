import { describe, expect, it } from "vitest";
import {
  type Reading,
  dailyRate,
  declines,
  formatChange,
  formatCompact,
  fundingHref,
  gapTotal,
  headline,
  loadFunding,
  parseMeasure,
  readingAt,
  readings,
  sameDayPriorYear,
  trailingTrend,
  yearPaths,
  yearRows,
  firstCrossing,
  totalSegments,
} from "../lib/funding";

// ADR-018: the funding page's numbers, on the committed fixture and on small synthetic series.

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

describe("yearPaths and trailingTrend", () => {
  it("builds a path per year with a baseline and skips years without one", () => {
    const paths = yearPaths(pledges, [2026, 2025, 2023]);
    expect(paths.map((p) => p.year)).toEqual([2026, 2025]);
    expect(paths[1]?.points.at(-1)?.doy).toBe(365);
    expect(paths[0]?.points[0]?.value).toBeGreaterThan(0);
  });

  it("computes the trailing change only where both windows exist", () => {
    const list = synthetic("2020-01-01", 1100, 10);
    const trend = trailingTrend(list, 100);
    expect(trend).toHaveLength(101);
    expect(trend[0]?.change).toBeCloseTo(0);
    expect(trailingTrend(synthetic("2020-01-01", 400, 10), 100)).toEqual([]);
  });
});

describe("rates, gaps, URL state and formatting", () => {
  it("spreads a jump across the days it covers", () => {
    const list = synthetic("2020-01-01", 10, 10, ["2020-01-05", "2020-01-06"]);
    const rate = dailyRate(list);
    expect(rate.find((r) => r.day === "2020-01-07")?.perDay).toBe(10);
    expect(rate).toHaveLength(list.length - 1);
  });

  it("totals the long gap and lists readings at a day", () => {
    const gap = series.source.gaps[0];
    if (gap === undefined) throw new Error("no gap");
    expect(gapTotal(pledges, gap)).toBeGreaterThan(1e8);
    expect(readingAt(pledges, "2023-01-01")).toBeNull();
    expect(readingAt(pledges, "2021-12-31")?.day).toBe("2021-12-31");
  });

  it("reads the measure from the query and writes the address", () => {
    expect(parseMeasure({})).toBe("pledges");
    expect(parseMeasure({ measure: "citizens" })).toBe("citizens");
    expect(parseMeasure({ measure: ["citizens"] })).toBe("citizens");
    expect(parseMeasure({ measure: "other" })).toBe("pledges");
    expect(fundingHref("pledges")).toBe("/funding");
    expect(fundingHref("citizens")).toBe("/funding?measure=citizens");
  });

  it("compares to the same calendar date a year earlier, 29 February included", () => {
    expect(sameDayPriorYear("2026-11-08")).toBe("2025-11-08");
    expect(sameDayPriorYear("2028-02-29")).toBe("2027-02-28");
    expect(sameDayPriorYear("2025-03-01")).toBe("2024-03-01");
  });

  it("lists the days the counter read lower than the day before", () => {
    const list: Reading[] = [
      { day: "2020-01-01", value: 10 },
      { day: "2020-01-02", value: 12 },
      { day: "2020-01-03", value: 11 },
      { day: "2020-01-04", value: 11 },
      { day: "2020-01-05", value: 9 },
    ];
    expect(declines(list)).toEqual([
      { day: "2020-01-03", by: 1 },
      { day: "2020-01-05", by: 2 },
    ]);
    const real = declines(pledges);
    expect(real.length).toBeGreaterThan(0);
    expect(real.some((d) => d.day.startsWith("2019-11"))).toBe(true);
  });

  it("formats compact values and signed changes", () => {
    expect(formatCompact(131_708_150, "pledges")).toBe("$131.7M");
    expect(formatCompact(6_753_476, "citizens")).toBe("6.8M");
    expect(formatChange(0.1994)).toBe("+19.9%");
    expect(formatChange(-0.15)).toBe("-15%");
    expect(formatChange(0)).toBe("0%");
  });
});

describe("totalSegments and firstCrossing", () => {
  const r = (day: string, value: number) => ({ day, value });
  const list = [
    r("2021-01-01", 10),
    r("2021-01-02", 11),
    r("2021-01-03", 12),
    r("2021-03-10", 20),
    r("2021-03-11", 21),
  ];
  it("splits the line at a gap and bridges it with the readings either side", () => {
    const segments = totalSegments(list, 60);
    expect(segments.map((s) => [s.bridge, s.points.map((p) => p.day)])).toEqual(
      [
        [false, ["2021-01-01", "2021-01-02", "2021-01-03"]],
        [true, ["2021-01-03", "2021-03-10"]],
        [false, ["2021-03-10", "2021-03-11"]],
      ],
    );
  });
  it("keeps one run when no gap reaches the threshold", () => {
    const segments = totalSegments(list, 100);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.bridge).toBe(false);
    expect(segments[0]?.points).toHaveLength(5);
    expect(totalSegments([], 60)).toEqual([]);
  });
  it("finds the first reading at or above a threshold", () => {
    expect(firstCrossing(list, 12)?.day).toBe("2021-01-03");
    expect(firstCrossing(list, 20)?.day).toBe("2021-03-10");
    expect(firstCrossing(list, 1000)).toBeNull();
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
    expect(real?.year).toBe(2026);
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
  });

  it("gives null where a month is unknown and nothing without two years", () => {
    const list = synthetic("2024-06-01", 300, 10);
    const rows = yearRows(list);
    const pairs = monthPairs(rows, list.at(-1)!.day);
    expect(pairs[0]?.lastYear).toBeNull();
    expect(pairs[0]?.change).toBeNull();
    expect(monthPairs(rows.slice(-1), list.at(-1)!.day)).toEqual([]);
    const real = monthPairs(yearRows(pledges), pledges.at(-1)!.day);
    expect(real).toHaveLength(11);
    expect(real.every((p) => p.thisYear !== null && p.lastYear !== null)).toBe(
      true,
    );
  });

  it("formats a share as a whole percentage", () => {
    expect(formatShare(0.784)).toBe("78%");
    expect(formatShare(1.2)).toBe("120%");
  });
});
