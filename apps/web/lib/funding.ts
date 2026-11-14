import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CounterReading,
  type FundingCounter,
  FundingCounter as FundingCounterSchema,
  type FundingSeries,
  FundingSeries as FundingSeriesSchema,
  type FundingSnapshot,
} from "schema";
import { REPO_ROOT } from "./data";
import { type Measure } from "./funding-format";
import {
  type LiveContext,
  type MeasureContext,
  type TimedValue,
  sameMomentCore,
} from "./funding-live";

export { SAME_MOMENT_SPREAD } from "./funding-live";

export {
  MEASURES,
  MONTHS,
  type Measure,
  formatChange,
  formatCompact,
  formatDay,
  formatReadAt,
  formatShare,
  formatShortDay,
  formatValue,
} from "./funding-format";

/**
 * The funding figures (ADR-018, drawn on the front page since ADR-040), all computed from RSI's
 * cumulative counters as the wiki API recorded them, one snapshot a day, and, after them, RSI's
 * counter as last read from RSI itself (amended 2026-11-13). Pure functions over the series,
 * unit-tested on the committed fixture. A month or year is reported only when a snapshot exists
 * close enough to both of its ends; otherwise it is "unknown", never estimated.
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

export const COUNTER_FILE = join(
  REPO_ROOT,
  "fixtures",
  "funding",
  "Counter.json",
);

export function loadCounter(): FundingCounter | null {
  if (!existsSync(COUNTER_FILE)) return null;
  return FundingCounterSchema.parse(
    JSON.parse(readFileSync(COUNTER_FILE, "utf8")),
  );
}

const snapshotOf = (r: CounterReading): FundingSnapshot => ({
  day: r.read_at.slice(0, 10),
  recorded_at: r.read_at,
  funds_usd: r.funds_usd,
  citizens: r.citizens,
});

/**
 * The series with RSI's counter after its snapshots, when the counter was read after the last of
 * them (ADR-018, amended 2026-11-13). The latest reading stands as its UTC day's snapshot, the
 * day's latest reading, so it takes the place of the wiki's own snapshot of that day. The counter's
 * last reading of an earlier day stands for a day between the two, the one the wiki recorded at
 * 20:00 UTC and the daily refresh has not copied yet, so between midnight and the refresh no month
 * or year closes on the day before its last; it never takes the place of a day the wiki has.
 * `counter` is the reading when it was used, null when the wiki's last snapshot is the latest.
 */
export function withCounter(
  series: FundingSeries,
  counter: FundingCounter | null,
): { readonly series: FundingSeries; readonly counter: FundingCounter | null } {
  const last = series.snapshots.at(-1);
  if (
    counter === null ||
    last === undefined ||
    !(Date.parse(counter.read_at) > Date.parse(last.recorded_at))
  ) {
    return { series, counter: null };
  }
  const latest = snapshotOf(counter);
  const before =
    counter.previous_day === null ? null : snapshotOf(counter.previous_day);
  const rows = [...series.snapshots];
  if (before !== null && before.day > last.day && before.day < latest.day) {
    rows.push(before);
  }
  if (rows.at(-1)?.day === latest.day) rows[rows.length - 1] = latest;
  else rows.push(latest);
  return { series: { ...series, snapshots: rows }, counter };
}

let cachedNow:
  | { readonly series: FundingSeries; readonly counter: FundingCounter | null }
  | null
  | undefined;

/** The front page's funding: the wiki's daily snapshots and, when it is newer, RSI's counter. */
export function fundingNow(): {
  readonly series: FundingSeries;
  readonly counter: FundingCounter | null;
} | null {
  if (cachedNow === undefined) {
    const series = funding();
    cachedNow = series === null ? null : withCounter(series, loadCounter());
  }
  return cachedNow;
}

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

/** The same calendar date a year earlier; 29 February falls back to 28 February. */
export function sameDayPriorYear(day: string): string {
  const year = Number(day.slice(0, 4)) - 1;
  const rest = day.slice(5);
  return `${year}-${rest === "02-29" ? "02-28" : rest}`;
}

export interface YearAgainstLastYear {
  readonly year: number;
  /** Added this calendar year so far; null when last year's end is unknown. */
  readonly yearToDate: number | null;
  /** Last year's whole total; null when either of its ends is unknown. */
  readonly lastYearTotal: number | null;
  /** yearToDate as a fraction of lastYearTotal; null when either is unknown. */
  readonly shareOfLastYear: number | null;
  /** yearToDate against the same days of last year, as a fraction. */
  readonly change: number | null;
}

/**
 * This year against the same days of last year, from the wiki's snapshots alone: the fallback for
 * `yearOnYear` when the comparison to RSI's latest reading cannot be shown (ADR-018, amended
 * 2026-11-13). Both years end on the wiki's reading at about 20:00 UTC of the same date. Null when
 * the snapshots' latest day is in another year than `year` (the first hours of a year, before the
 * refresh copies its first snapshot), so the comparison never crosses a year.
 */
export function sameDaysChange(
  snapshots: readonly Reading[],
  year: number,
): { readonly change: number | null; readonly to: string } | null {
  const head = headline(snapshots);
  if (head === null || Number(head.latest.day.slice(0, 4)) !== year) {
    return null;
  }
  return { change: head.yearToDateChange, to: head.latest.day };
}

/** A measure's readings with the time each was taken, in time order. */
function timedValues(series: FundingSeries, measure: Measure): TimedValue[] {
  const out: TimedValue[] = [];
  for (const s of series.snapshots) {
    const value = measure === "pledges" ? s.funds_usd : s.citizens;
    if (value !== null) out.push({ at: s.recorded_at, value });
  }
  return out;
}

/** The reading standing for the end of `day` (`readingAt`), with the time it was taken. */
function timedAt(
  series: FundingSeries,
  measure: Measure,
  day: string,
): TimedValue | null {
  const r = readingAt(readings(series, measure), day);
  if (r === null) return null;
  const s = series.snapshots.find((x) => x.day === r.day);
  return s === undefined ? null : { at: s.recorded_at, value: r.value };
}

/**
 * This year so far, to RSI's latest reading, against last year over the same length of time
 * (ADR-018, amended 2026-11-13; `sameMomentCore` in `funding-live.ts`, which the browser runs
 * too). Both are counted from their year's start reading (the wiki's of 31 December, or the one
 * standing for it), so a leap day or a start reading taken early adds nothing to this year's side;
 * the change is taken against last year's next daily reading, so it can understate this year's
 * lead by up to a day of last year's, never overstate it. Null where the core gives none; the
 * wiki's own comparison, with its day, stands then.
 */
export function sameMomentChange(
  series: FundingSeries,
  measure: Measure,
  counter: CounterReading,
): number | null {
  const year = Number(counter.read_at.slice(0, 4));
  const startThis = timedAt(series, measure, `${year - 1}-12-31`);
  const startLast = timedAt(series, measure, `${year - 2}-12-31`);
  if (startThis === null || startLast === null) return null;
  return sameMomentCore({
    startThis,
    startLast,
    lastYear: timedValues(series, measure),
    now: measure === "pledges" ? counter.funds_usd : counter.citizens,
    readAt: counter.read_at,
  });
}

export interface YearOnYear {
  /** This year so far against the same days of last year, as a fraction; null when unknown. */
  readonly change: number | null;
  /** The day the comparison runs to when it is not the latest reading's; null when it is. */
  readonly to: string | null;
}

/**
 * The front page's year-on-year figure (ADR-018, amended 2026-11-13): with RSI's counter as the
 * latest reading, against last year to the same moment, or, where that cannot be shown, the
 * wiki's own comparison with the day it runs to; with the wiki's snapshot as the latest, the
 * wiki's comparison, which runs to that reading.
 */
export function yearOnYear(
  series: FundingSeries,
  measure: Measure,
  counter: CounterReading | null,
): YearOnYear {
  const list = readings(series, measure);
  if (counter === null) {
    return { change: headline(list)?.yearToDateChange ?? null, to: null };
  }
  const current = sameMomentChange(series, measure, counter);
  if (current !== null) return { change: current, to: null };
  const days = sameDaysChange(list, Number(counter.read_at.slice(0, 4)));
  if (days === null) return { change: null, to: null };
  // The wiki's comparison names its day only when that is not the reading's own.
  return {
    change: days.change,
    to: days.to === counter.read_at.slice(0, 10) ? null : days.to,
  };
}

/**
 * This year against last year, for the front page's funding card (ADR-038): the year so far, how
 * much of last year's whole total it has reached, and the change on the same days of last year.
 * Everything is a difference between snapshots, as on the ledger; nothing is estimated.
 */
export function yearAgainstLastYear(
  list: readonly Reading[],
): YearAgainstLastYear | null {
  const head = headline(list);
  if (head === null) return null;
  const year = Number(head.latest.day.slice(0, 4));
  const lastYear = yearRows(list).find((r) => r.year === year - 1);
  const lastYearTotal =
    lastYear === undefined || lastYear.partial ? null : lastYear.total;
  return {
    year,
    yearToDate: head.yearToDate,
    lastYearTotal,
    shareOfLastYear:
      head.yearToDate === null || lastYearTotal === null || lastYearTotal === 0
        ? null
        : head.yearToDate / lastYearTotal,
    change: head.yearToDateChange,
  };
}

export interface MonthPair {
  /** January is 0. */
  readonly month: number;
  readonly thisYear: number | null;
  readonly lastYear: number | null;
  /**
   * thisYear against lastYear, as a fraction; null when either is unknown, and for the current
   * month, which is not over and would be read against a whole one.
   */
  readonly change: number | null;
  /** The month the latest reading falls in, which is not over. */
  readonly current: boolean;
}

/**
 * Each month of the latest year so far beside the same month of the year before (ADR-038), from
 * January to the month of the latest reading. Empty when the rows hold fewer than two years.
 */
export function monthPairs(
  rows: readonly YearRow[],
  latestDay: string,
): MonthPair[] {
  const latest = rows.at(-1);
  const before = rows.at(-2);
  if (latest === undefined || before === undefined) return [];
  const currentMonth = Number(latestDay.slice(5, 7)) - 1;
  const out: MonthPair[] = [];
  for (let m = 0; m <= currentMonth; m += 1) {
    const thisYear = latest.months[m] ?? null;
    const lastYear = before.months[m] ?? null;
    const current = m === currentMonth;
    out.push({
      month: m,
      thisYear,
      lastYear,
      change:
        current || thisYear === null || lastYear === null || lastYear === 0
          ? null
          : thisYear / lastYear - 1,
      current,
    });
  }
  return out;
}

/**
 * What the browser needs to recompute the front page's funding figures from RSI's counter
 * (ADR-018, amended 2026-11-13; `liveFigures` in `funding-live.ts`): for each measure, the start
 * readings, last year's readings from two days before today's point to a fortnight after it, the
 * last six weeks' readings and the wiki's own comparison. A few dozen numbers. `series` is the
 * front page's (the wiki's with RSI's counter after it), `wiki` the wiki's alone.
 */
export function liveContext(
  wiki: FundingSeries,
  series: FundingSeries,
): LiveContext | null {
  const last = series.snapshots.at(-1);
  if (last === undefined) return null;
  const latestAt = last.recorded_at;
  const year = Number(last.day.slice(0, 4));
  const part = (measure: Measure): MeasureContext | null => {
    const list = readings(series, measure);
    const latest = list.at(-1);
    if (latest === undefined) return null;
    const startThis = timedAt(series, measure, `${year - 1}-12-31`);
    const startLast = timedAt(series, measure, `${year - 2}-12-31`);
    let lastYear: TimedValue[] = [];
    if (startThis !== null && startLast !== null) {
      const moment =
        Date.parse(startLast.at) +
        (Date.parse(latestAt) - Date.parse(startThis.at));
      lastYear = timedValues(wiki, measure).filter((r) => {
        const t = Date.parse(r.at);
        return t >= moment - 2 * DAY_MS && t <= moment + 16 * DAY_MS;
      });
    }
    const from = dayString(dayNumber(last.day) - 45);
    return {
      startThis,
      startLast,
      lastYearTotal: yearAgainstLastYear(list)?.lastYearTotal ?? null,
      lastYear,
      // Only the citizens' counter says "in the last 30 days".
      recent:
        measure === "citizens"
          ? list
              .filter((r) => r.day >= from)
              .map((r) => ({ day: r.day, value: r.value }))
          : [],
      fallback: sameDaysChange(readings(wiki, measure), year),
      latest: latest.value,
    };
  };
  const pledges = part("pledges");
  if (pledges === null) return null;
  return { latestAt, year, pledges, citizens: part("citizens") };
}
