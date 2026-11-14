import {
  type Measure,
  formatChange,
  formatCompact,
  formatReadAt,
  formatShare,
  formatShortDay,
  formatValue,
} from "./funding-format";

/**
 * The front page's funding figures from RSI's counter as the browser reads it (ADR-018, amended
 * 2026-11-13). Pure, with no data access, so it runs in the browser and on the server alike: the
 * server builds the `LiveContext` from the committed series, the browser asks the site's
 * `/api/funding/live` for RSI's counter about once a minute and recomputes every figure the page
 * prints from it, in the server's own words and formats.
 */

/** A reading with the time it was taken. */
export interface TimedValue {
  readonly at: string;
  readonly value: number;
}

/**
 * How far apart a same-moment comparison's two bounds may be and the comparison still be shown:
 * five points, so it shows through last year's big sales (up to about four points low then) and
 * falls back only where a few hours of last year weigh more, in its first weeks.
 */
export const SAME_MOMENT_SPREAD = 0.05;

/**
 * This year so far against last year over the same length of time, both counted from their
 * year's start reading (ADR-018, amended 2026-11-13). Last year has one reading a day, so the same
 * point falls between two of them; the change is taken against the later one, which gives last
 * year at least as long as this year has had, so the figure can understate this year's lead by up
 * to a day of last year's, never overstate it. `lastYear` is last year's readings in time order,
 * from at least a day before the point. Null when either neighbouring reading is missing or they
 * are not a day apart, when either side has added nothing, or when the earlier reading would give
 * a change more than SAME_MOMENT_SPREAD away.
 */
export function sameMomentCore(input: {
  readonly startThis: TimedValue;
  readonly startLast: TimedValue;
  readonly lastYear: readonly TimedValue[];
  readonly now: number;
  readonly readAt: string;
}): number | null {
  const { startThis, startLast, lastYear, now, readAt } = input;
  // The point in last year as far from its start reading as this reading is from this year's.
  const moment =
    Date.parse(startLast.at) + (Date.parse(readAt) - Date.parse(startThis.at));
  let before: TimedValue | undefined;
  let after: TimedValue | undefined;
  for (const r of lastYear) {
    if (Date.parse(r.at) <= moment) before = r;
    else {
      after = r;
      break;
    }
  }
  if (before === undefined || after === undefined) return null;
  if (Date.parse(after.at) - Date.parse(before.at) > 30 * 3_600_000) {
    return null;
  }
  const lastYearLong = after.value - startLast.value;
  const lastYearShort = before.value - startLast.value;
  if (lastYearLong <= 0 || lastYearShort <= 0) return null;
  const ytd = now - startThis.value;
  const change = ytd / lastYearLong - 1;
  const other = ytd / lastYearShort - 1;
  return Math.abs(other - change) > SAME_MOMENT_SPREAD ? null : change;
}

/** One measure's part of the context: what the figures are differences from. */
export interface MeasureContext {
  /** This year's start reading (the one standing for last 31 December). */
  readonly startThis: TimedValue | null;
  /** Last year's. */
  readonly startLast: TimedValue | null;
  /** Last year's whole total; null when unknown. */
  readonly lastYearTotal: number | null;
  /** Last year's readings around the same point, in time order. */
  readonly lastYear: readonly TimedValue[];
  /** The readings of the last weeks, by UTC day, for "in the last 30 days". */
  readonly recent: readonly { readonly day: string; readonly value: number }[];
  /** The wiki's own comparison, the fallback: its change and the day it runs to. */
  readonly fallback: {
    readonly change: number | null;
    readonly to: string;
  } | null;
  /** The page's latest value, for the plausibility check. */
  readonly latest: number;
}

export interface LiveContext {
  /** When the page's latest reading was taken; a live reading must be newer. */
  readonly latestAt: string;
  /** The year the page's figures are of. */
  readonly year: number;
  readonly pledges: MeasureContext;
  readonly citizens: MeasureContext | null;
}

export interface LiveReading {
  readonly read_at: string;
  readonly funds_usd: number;
  readonly citizens: number;
}

/** Every text the live figures replace, by the slot that prints it. */
export type LiveField =
  | "pledged"
  | "pledgedNote"
  | "citizens"
  | "citizensNote"
  | "thisYear"
  | "thisYearNote"
  | "head"
  | `${Measure}.ytd`
  | `${Measure}.ytdShort`
  | `${Measure}.ytdNote`
  | `${Measure}.share`
  | `${Measure}.yoy`
  | `${Measure}.yoyNote`
  | "readAtSentence";

export type LiveFigures = Partial<Record<LiveField, string>>;

/** "+22.6K" / "−12": a change with its sign. */
function signed(value: number, format: (abs: number) => string): string {
  if (value === 0) return format(0);
  return `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;
}

const DAY_MS = 86_400_000;
/** As the series' periods: a reading within three days before a day stands for it. */
const TOLERANCE_DAYS = 3;

function readingOn(
  list: readonly { readonly day: string; readonly value: number }[],
  day: string,
): number | null {
  let found: { readonly day: string; readonly value: number } | null = null;
  for (const r of list) {
    if (r.day <= day) found = r;
    else break;
  }
  if (found === null) return null;
  const gap = Math.round((Date.parse(day) - Date.parse(found.day)) / DAY_MS);
  return gap <= TOLERANCE_DAYS ? found.value : null;
}

/** This year against last year for one measure at a reading: the change and its day, or null. */
export function yearOnYearAt(
  m: MeasureContext,
  now: number,
  readAt: string,
): { readonly change: number | null; readonly to: string | null } {
  const current =
    m.startThis === null || m.startLast === null
      ? null
      : sameMomentCore({
          startThis: m.startThis,
          startLast: m.startLast,
          lastYear: m.lastYear,
          now,
          readAt,
        });
  if (current !== null) return { change: current, to: null };
  if (m.fallback === null) return { change: null, to: null };
  // The wiki's comparison names its day only when that is not the reading's own.
  return {
    change: m.fallback.change,
    to: m.fallback.to === readAt.slice(0, 10) ? null : m.fallback.to,
  };
}

/**
 * The page's funding texts at a reading, or null when the reading should not replace the page's:
 * not newer than it, of another year than the page's figures (they are differences from that
 * year's start), or below half the page's latest value for either measure (ADR-018's rule).
 */
export function liveFigures(
  ctx: LiveContext,
  reading: LiveReading,
): LiveFigures | null {
  if (!(Date.parse(reading.read_at) > Date.parse(ctx.latestAt))) return null;
  if (Number(reading.read_at.slice(0, 4)) !== ctx.year) return null;
  if (reading.funds_usd < ctx.pledges.latest * 0.5) return null;
  if (ctx.citizens !== null && reading.citizens < ctx.citizens.latest * 0.5) {
    return null;
  }
  const day = reading.read_at.slice(0, 10);
  const year = ctx.year;
  const out: Record<string, string> = {
    pledged: formatValue(reading.funds_usd, "pledges"),
    pledgedNote: `as of ${formatReadAt(reading.read_at, true)}`,
    head: `as of ${formatReadAt(reading.read_at)}`,
    readAtSentence: ` The latest figures are RSI's counter itself, read ${formatReadAt(reading.read_at)}; while the page is open it follows the counter minute by minute.`,
  };
  const measures: readonly [Measure, MeasureContext | null, number][] = [
    ["pledges", ctx.pledges, reading.funds_usd],
    ["citizens", ctx.citizens, reading.citizens],
  ];
  for (const [measure, m, now] of measures) {
    if (m === null) continue;
    const ytd = m.startThis === null ? null : now - m.startThis.value;
    const yoy = yearOnYearAt(m, now, reading.read_at);
    if (ytd !== null) {
      out[`${measure}.ytd`] = formatValue(ytd, measure);
      out[`${measure}.ytdShort`] = formatCompact(ytd, measure);
      out[`${measure}.share`] =
        m.lastYearTotal === null || m.lastYearTotal === 0
          ? "unknown"
          : formatShare(ytd / m.lastYearTotal);
    }
    out[`${measure}.ytdNote`] = `to ${formatShortDay(day)}`;
    out[`${measure}.yoy`] =
      yoy.change === null ? "unknown" : formatChange(yoy.change);
    out[`${measure}.yoyNote`] =
      yoy.to === null
        ? `on the same days of ${year - 1}`
        : `to ${formatShortDay(yoy.to)}, on the same days of ${year - 1}`;
    if (measure === "pledges" && ytd !== null) {
      out["thisYear"] = formatCompact(ytd, "pledges");
      out["thisYearNote"] =
        yoy.change === null
          ? "so far"
          : `${formatChange(yoy.change)} on the same days of ${year - 1}${yoy.to === null ? "" : `, to ${formatShortDay(yoy.to)}`}`;
    }
    if (measure === "citizens") {
      out["citizens"] = formatValue(now, "citizens");
      const back = readingOn(
        m.recent,
        new Date(Date.parse(day) - 30 * DAY_MS).toISOString().slice(0, 10),
      );
      out["citizensNote"] =
        back === null
          ? "on record"
          : `${signed(now - back, (n) => formatCompact(n, "citizens"))} in the last 30 days`;
    }
  }
  return out;
}
