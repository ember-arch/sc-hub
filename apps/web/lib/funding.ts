import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type FundingSeries,
  FundingSeries as FundingSeriesSchema,
} from "schema";
import { REPO_ROOT } from "./data";

/**
 * The funding page's numbers (ADR-018), all computed from RSI's cumulative counters as the wiki
 * API recorded them, one snapshot a day. Pure functions over the series, unit-tested on the
 * committed fixture. A month or year is reported only when a snapshot exists close enough to
 * both of its ends; otherwise it is "unknown", never estimated.
 */

export const FUNDING_FILE = join(
  REPO_ROOT,
  "fixtures",
  "funding",
  "Funding.json",
);

export function loadFunding(): FundingSeries | null {
  if (!existsSync(FUNDING_FILE)) return null;
  return FundingSeriesSchema.parse(
    JSON.parse(readFileSync(FUNDING_FILE, "utf8")),
  );
}

let cached: FundingSeries | null | undefined;

export function funding(): FundingSeries | null {
  if (cached === undefined) cached = loadFunding();
  return cached;
}

export const MEASURES = ["pledges", "citizens"] as const;
export type Measure = (typeof MEASURES)[number];

export type Query = Readonly<Record<string, string | string[] | undefined>>;

/** `?measure=citizens`; anything else means pledges. */
export function parseMeasure(query: Query): Measure {
  const raw = query["measure"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "citizens" ? "citizens" : "pledges";
}

export const fundingHref = (measure: Measure): string =>
  measure === "pledges" ? "/funding" : `/funding?measure=${measure}`;

const DAY_MS = 86_400_000;
export const dayNumber = (day: string): number =>
  Math.round(Date.parse(day) / DAY_MS);
const dayString = (n: number): string =>
  new Date(n * DAY_MS).toISOString().slice(0, 10);

/** How far a snapshot may sit from a period's edge and still stand for it. */
export const TOLERANCE_DAYS = 3;

export interface Reading {
  readonly day: string;
  readonly value: number;
}

export function readings(series: FundingSeries, measure: Measure): Reading[] {
  const out: Reading[] = [];
  for (const s of series.snapshots) {
    const value = measure === "pledges" ? s.funds_usd : s.citizens;
    if (value !== null) out.push({ day: s.day, value });
  }
  return out;
}

/** Binary search: the last reading on or before `day`, or null. */
function lastOnOrBefore(list: readonly Reading[], day: string): Reading | null {
  let lo = 0;
  let hi = list.length - 1;
  let found: Reading | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = list[mid];
    if (r === undefined) break;
    if (r.day <= day) {
      found = r;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** The reading that stands for the end of `day`: the last one at most TOLERANCE_DAYS before it. */
export function readingAt(
  list: readonly Reading[],
  day: string,
): Reading | null {
  const r = lastOnOrBefore(list, day);
  if (r === null) return null;
  return dayNumber(day) - dayNumber(r.day) <= TOLERANCE_DAYS ? r : null;
}

const lastDayOfMonth = (year: number, month: number): string =>
  new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

export interface Period {
  readonly key: string;
  /** The amount added in the period, or null when a snapshot is missing at either end. */
  readonly value: number | null;
  /** True for the period the latest reading falls in, which is not over yet. */
  readonly partial: boolean;
}

export interface YearRow {
  readonly year: number;
  readonly total: number | null;
  readonly partial: boolean;
  /** Change from the previous year's total, as a fraction; null when either is unknown. */
  readonly change: number | null;
  /** January to December; null where unknown. */
  readonly months: readonly (number | null)[];
}

/** One row per calendar year from the first reading to the latest, with its months. */
export function yearRows(list: readonly Reading[]): YearRow[] {
  const first = list[0];
  const last = list.at(-1);
  if (first === undefined || last === undefined) return [];
  const firstYear = Number(first.day.slice(0, 4));
  const lastYear = Number(last.day.slice(0, 4));
  const rows: YearRow[] = [];
  let prevTotal: number | null = null;
  for (let year = firstYear; year <= lastYear; year += 1) {
    const months: (number | null)[] = [];
    for (let m = 1; m <= 12; m += 1) {
      const end = lastDayOfMonth(year, m);
      const start = lastDayOfMonth(year, m - 1);
      if (end < first.day || start > last.day) {
        months.push(null);
        continue;
      }
      // The first period is counted from the first snapshot: what was raised before it is not in
      // any month. Periods after the latest snapshot are open, so the latest reading ends them.
      const endReading = end > last.day ? last : readingAt(list, end);
      const startReading = start < first.day ? first : readingAt(list, start);
      months.push(
        endReading === null || startReading === null
          ? null
          : endReading.value - startReading.value,
      );
    }
    const yearEnd = `${year}-12-31`;
    const yearStart = `${year - 1}-12-31`;
    const endReading = yearEnd > last.day ? last : readingAt(list, yearEnd);
    const startReading =
      yearStart < first.day ? first : readingAt(list, yearStart);
    const total =
      endReading === null || startReading === null
        ? null
        : endReading.value - startReading.value;
    const partial = year === lastYear;
    rows.push({
      year,
      total,
      partial,
      change:
        total === null || prevTotal === null || prevTotal === 0 || partial
          ? null
          : total / prevTotal - 1,
      months,
    });
    prevTotal = total;
  }
  return rows;
}

export interface Headline {
  readonly latest: Reading;
  /** Added this calendar year so far; null when last year's end is unknown. */
  readonly yearToDate: number | null;
  /** The same stretch of last year, to the same day; null when unknown. */
  readonly lastYearToSameDay: number | null;
  /** yearToDate against lastYearToSameDay, as a fraction. */
  readonly yearToDateChange: number | null;
  /** Added over the last 365 days, and the 365 before that. */
  readonly trailing: number | null;
  readonly trailingBefore: number | null;
  readonly trailingChange: number | null;
  /** Added in the last 30 days. */
  readonly last30: number | null;
}

export function headline(list: readonly Reading[]): Headline | null {
  const latest = list.at(-1);
  if (latest === undefined) return null;
  const n = dayNumber(latest.day);
  const year = Number(latest.day.slice(0, 4));
  const at = (day: string): number | null =>
    readingAt(list, day)?.value ?? null;
  const diff = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : a - b;
  const ratio = (a: number | null, b: number | null): number | null =>
    a === null || b === null || b === 0 ? null : a / b - 1;
  const lastYearEnd = at(`${year - 1}-12-31`);
  const sameDayLastYear = at(sameDayPriorYear(latest.day));
  const yearBeforeEnd = at(`${year - 2}-12-31`);
  const yearToDate = diff(latest.value, lastYearEnd);
  const lastYearToSameDay = diff(sameDayLastYear, yearBeforeEnd);
  const trailing = diff(latest.value, at(dayString(n - 365)));
  const trailingBefore = diff(at(dayString(n - 365)), at(dayString(n - 730)));
  return {
    latest,
    yearToDate,
    lastYearToSameDay,
    yearToDateChange: ratio(yearToDate, lastYearToSameDay),
    trailing,
    trailingBefore,
    trailingChange: ratio(trailing, trailingBefore),
    last30: diff(latest.value, at(dayString(n - 30))),
  };
}

export interface YearPath {
  readonly year: number;
  /** Day of year (1 to 366) and the amount added since the year began, in reading order. */
  readonly points: readonly { readonly doy: number; readonly value: number }[];
}

const dayOfYear = (day: string): number =>
  dayNumber(day) - dayNumber(`${day.slice(0, 4)}-01-01`) + 1;

/** The running total within each of the given years, from readings; years with no baseline are left out. */
export function yearPaths(
  list: readonly Reading[],
  years: readonly number[],
): YearPath[] {
  return years.flatMap((year) => {
    const base = readingAt(list, `${year - 1}-12-31`);
    if (base === null) return [];
    const points = list
      .filter((r) => r.day.startsWith(`${year}-`))
      .map((r) => ({ doy: dayOfYear(r.day), value: r.value - base.value }));
    return points.length < 2 ? [] : [{ year, points }];
  });
}

export interface TrendPoint {
  readonly day: string;
  /** Trailing 365-day total against the 365 before, as a fraction. */
  readonly change: number;
}

/** The trailing-year change for every reading in the last `days`, where both windows are known. */
export function trailingTrend(
  list: readonly Reading[],
  days = 730,
): TrendPoint[] {
  const latest = list.at(-1);
  if (latest === undefined) return [];
  const from = dayNumber(latest.day) - days;
  const out: TrendPoint[] = [];
  for (const r of list) {
    const n = dayNumber(r.day);
    if (n < from) continue;
    const a = readingAt(list, dayString(n - 365));
    const b = readingAt(list, dayString(n - 730));
    if (a === null || b === null) continue;
    const before = a.value - b.value;
    if (before <= 0) continue;
    out.push({ day: r.day, change: (r.value - a.value) / before - 1 });
  }
  return out;
}

export interface DailyPoint {
  readonly day: string;
  /** Added per day across the stretch since the previous reading. */
  readonly perDay: number;
}

/** The amount added per day between consecutive readings, for the whole history. */
export function dailyRate(list: readonly Reading[]): DailyPoint[] {
  const out: DailyPoint[] = [];
  for (let i = 1; i < list.length; i += 1) {
    const prev = list[i - 1];
    const r = list[i];
    if (prev === undefined || r === undefined) continue;
    const span = dayNumber(r.day) - dayNumber(prev.day);
    out.push({ day: r.day, perDay: (r.value - prev.value) / span });
  }
  return out;
}

/** The amount added across a gap in the data, for the note under the monthly grid. */
/** A run of readings for the running-total line;  spans a gap in the data (drawn dashed). */
export interface TotalSegment {
  readonly points: readonly Reading[];
  readonly bridge: boolean;
}

/**
 * The running total as runs of readings, split where the data has no snapshot for  or
 * more: each such stretch becomes a two-point bridge between the readings either side, so the
 * line can show where it is drawn through nothing (ADR-018: never estimated, only joined).
 */
export function totalSegments(
  list: readonly Reading[],
  minDays: number,
): TotalSegment[] {
  const out: TotalSegment[] = [];
  let run: Reading[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const r = list[i]!;
    const prev = list[i - 1];
    if (
      prev !== undefined &&
      dayNumber(r.day) - dayNumber(prev.day) >= minDays
    ) {
      if (run.length > 0) out.push({ points: run, bridge: false });
      out.push({ points: [prev, r], bridge: true });
      run = [r];
      continue;
    }
    run.push(r);
  }
  if (run.length > 1 || (run.length === 1 && out.length === 0))
    out.push({ points: run, bridge: false });
  return out;
}

/** The first reading at or above , or null when the counter has not reached it. */
export function firstCrossing(
  list: readonly Reading[],
  threshold: number,
): Reading | null {
  return list.find((r) => r.value >= threshold) ?? null;
}

/** The same calendar date a year earlier; 29 February falls back to 28 February. */
export function sameDayPriorYear(day: string): string {
  const year = Number(day.slice(0, 4)) - 1;
  const rest = day.slice(5);
  return `${year}-${rest === "02-29" ? "02-28" : rest}`;
}

export interface Decline {
  readonly day: string;
  /** How far the reading fell from the previous one. */
  readonly by: number;
}

/** Days on which the counter read lower than the reading before, as recorded. */
export function declines(list: readonly Reading[]): Decline[] {
  const out: Decline[] = [];
  for (let i = 1; i < list.length; i += 1) {
    const prev = list[i - 1];
    const r = list[i];
    if (prev !== undefined && r !== undefined && r.value < prev.value) {
      out.push({ day: r.day, by: prev.value - r.value });
    }
  }
  return out;
}

export function gapTotal(
  list: readonly Reading[],
  gap: { readonly from: string; readonly to: string },
): number | null {
  const before = lastOnOrBefore(list, gap.from);
  const after = list.find((r) => r.day > gap.to);
  return before === null || after === undefined
    ? null
    : after.value - before.value;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/** "$1,061,028,177" or "6,753,476". */
export function formatValue(value: number, measure: Measure): string {
  return measure === "pledges"
    ? usd.format(value)
    : new Intl.NumberFormat("en-US").format(value);
}

/** "$131.7M" or "280K"; short enough for a bar's end label. */
export function formatCompact(value: number, measure: Measure): string {
  return measure === "pledges"
    ? compactUsd.format(value)
    : compactNumber.format(value);
}

/** "+19.9%" with the sign always shown, "0%" for no change. */
export function formatChange(fraction: number): string {
  return percent.format(fraction);
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const longDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(day: string): string {
  return longDay.format(new Date(`${day}T00:00:00Z`));
}
