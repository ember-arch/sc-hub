/**
 * The funding figures' formats (ADR-018, ADR-040): pure, with no data access, so the front page's
 * live figures in the browser format exactly as the server does (ADR-018, amended 2026-11-13).
 */

export const MEASURES = ["pledges", "citizens"] as const;
export type Measure = (typeof MEASURES)[number];

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

/** "14 November 2026, 01:28 UTC", or "14 Nov, 01:28 UTC" when short: a counter reading's time. */
export function formatReadAt(iso: string, short = false): string {
  const day = iso.slice(0, 10);
  const time = `${iso.slice(11, 16)} UTC`;
  if (!short) return `${formatDay(day)}, ${time}`;
  return `${formatShortDay(day)}, ${time}`;
}

/** "12 Nov". */
export function formatShortDay(day: string): string {
  const month = MONTHS[Number(day.slice(5, 7)) - 1] ?? "";
  return `${Number(day.slice(8, 10))} ${month}`;
}

const wholePercent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** "78%": a share of a whole, no sign. */
export function formatShare(fraction: number): string {
  return wholePercent.format(fraction);
}
