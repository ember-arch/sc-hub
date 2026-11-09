/**
 * Maps the Star Citizen Wiki API's `/api/v2/stats` rows onto `FundingSnapshot` (ADR-018). Pure,
 * so the unit tests run it on a committed sample. One row per UTC day, the latest reading that
 * day. Any row that is not exactly the shape seen on 2026-11-08 halts the run.
 */

import type { FundingSnapshot } from "schema";
import { z } from "zod";

/** The API's row, exactly as seen; `fleet` repeats `fans` and is not used. */
export const WikiStatsRow = z.strictObject({
  funds: z.string().regex(/^\d+(\.\d{1,2})?$/),
  fans: z.int().nonnegative(),
  fleet: z.int().nonnegative(),
  timestamp: z.iso.datetime({ offset: true }),
});
export type WikiStatsRow = z.infer<typeof WikiStatsRow>;

export const WikiStatsPage = z.looseObject({
  data: z.array(WikiStatsRow),
  meta: z.looseObject({
    current_page: z.int().positive(),
    last_page: z.int().positive(),
  }),
});

/** RSI's counter started counting citizens in August 2013; before that the API stores 0. */
export const FIRST_CITIZEN_DAY = "2013-08-19";

export function mapSnapshots(rows: readonly WikiStatsRow[]): FundingSnapshot[] {
  const byDay = new Map<string, FundingSnapshot>();
  for (const row of rows) {
    const day = row.timestamp.slice(0, 10);
    const snapshot: FundingSnapshot = {
      day,
      recorded_at: row.timestamp,
      funds_usd: Number(row.funds),
      citizens: day < FIRST_CITIZEN_DAY && row.fans === 0 ? null : row.fans,
    };
    const prior = byDay.get(day);
    if (prior === undefined || row.timestamp > prior.recorded_at) {
      byDay.set(day, snapshot);
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * A reading below this share of the previous one cannot be a cumulative total: the API has one
 * such row (9 June 2021, $0). RSI's own corrections (November 2019, a few percent) stay.
 */
export const IMPLAUSIBLE_SHARE = 0.5;

export interface Dropped {
  readonly day: string;
  readonly funds_usd: number;
  readonly previous_funds_usd: number;
}

/** Splits off snapshots whose total fell below half the previous kept one. */
export function dropImplausible(snapshots: readonly FundingSnapshot[]): {
  kept: FundingSnapshot[];
  dropped: Dropped[];
} {
  const kept: FundingSnapshot[] = [];
  const dropped: Dropped[] = [];
  let lastCitizens: number | null = null;
  for (const s of snapshots) {
    const prev = kept.at(-1);
    if (
      prev !== undefined &&
      s.funds_usd < prev.funds_usd * IMPLAUSIBLE_SHARE
    ) {
      dropped.push({
        day: s.day,
        funds_usd: s.funds_usd,
        previous_funds_usd: prev.funds_usd,
      });
      continue;
    }
    // The same rule for citizens, on the field alone: the money reading that day still stands.
    const citizens: number | null =
      s.citizens !== null &&
      lastCitizens !== null &&
      s.citizens < lastCitizens * IMPLAUSIBLE_SHARE
        ? null
        : s.citizens;
    if (citizens !== null) lastCitizens = citizens;
    kept.push(citizens === s.citizens ? s : { ...s, citizens });
  }
  return { kept, dropped };
}

export interface Gap {
  readonly from: string;
  readonly to: string;
  readonly days: number;
}

const DAY_MS = 86_400_000;

/** Runs of calendar days with no snapshot, between two snapshots; longest first. */
export function findGaps(snapshots: readonly FundingSnapshot[]): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 1; i < snapshots.length; i += 1) {
    const prev = snapshots[i - 1];
    const next = snapshots[i];
    if (prev === undefined || next === undefined) continue;
    const span = Math.round(
      (Date.parse(next.day) - Date.parse(prev.day)) / DAY_MS,
    );
    if (span > 1) {
      const from = new Date(Date.parse(prev.day) + DAY_MS)
        .toISOString()
        .slice(0, 10);
      const to = new Date(Date.parse(next.day) - DAY_MS)
        .toISOString()
        .slice(0, 10);
      gaps.push({ from, to, days: span - 1 });
    }
  }
  return gaps.sort((a, b) => b.days - a.days || a.from.localeCompare(b.from));
}
