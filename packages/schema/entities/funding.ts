import { z } from "zod";
import { Timestamp } from "../common.js";

/**
 * Funding (ADR-018): RSI's public counters of money pledged and citizens registered, one
 * snapshot a day as the Star Citizen Wiki API records them (`/api/v2/stats`). Not game data; copied
 * by `scripts/funding/fetch.ts`, never written by hand, into `fixtures/funding/`. Totals are
 * cumulative since the campaign began; everything the page shows is computed from differences.
 */

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const FundingSnapshot = z.strictObject({
  /** The UTC calendar day of the snapshot. One row per day: the latest reading that day. */
  day: Day,
  recorded_at: Timestamp,
  /** Total pledged since 2012, in US dollars as RSI publishes it (cents kept). */
  funds_usd: z.number().nonnegative(),
  /** Registered citizens. RSI published no count before August 2013; null then. */
  citizens: z.int().nonnegative().nullable(),
});
export type FundingSnapshot = z.infer<typeof FundingSnapshot>;

/** `fixtures/funding/Funding.json`. */
export const FundingSeries = z
  .strictObject({
    source: z.strictObject({
      name: z.literal("Star Citizen Wiki API"),
      url: z.url(),
      /** Where RSI itself publishes the counters. */
      origin_url: z.url(),
      fetched_at: Timestamp,
      /** Snapshots left out because the total fell below half the previous one: a recording failure, not a correction. */
      dropped: z.array(
        z.strictObject({
          day: Day,
          funds_usd: z.number().nonnegative(),
          previous_funds_usd: z.number().nonnegative(),
        }),
      ),
      /** Days the API has no snapshot for, as closed ranges, longest first. */
      gaps: z.array(
        z.strictObject({ from: Day, to: Day, days: z.int().positive() }),
      ),
    }),
    /** Ascending by day, no two rows the same day. */
    snapshots: z.array(FundingSnapshot).min(2),
  })
  .superRefine((series, ctx) => {
    for (let i = 1; i < series.snapshots.length; i += 1) {
      const prev = series.snapshots[i - 1];
      const row = series.snapshots[i];
      if (prev !== undefined && row !== undefined && !(row.day > prev.day)) {
        ctx.addIssue({
          code: "custom",
          path: ["snapshots", i, "day"],
          message: `snapshots must ascend by day; ${row.day} follows ${prev.day}`,
        });
      }
    }
  });
export type FundingSeries = z.infer<typeof FundingSeries>;
