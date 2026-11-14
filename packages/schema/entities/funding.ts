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

/** One reading of RSI's counters, at a UTC time ("Z"), so its UTC day is the time's first ten characters. */
export const CounterReading = z.strictObject({
  read_at: z.iso.datetime(),
  /** Total pledged since 2012, in US dollars (RSI answers in cents). */
  funds_usd: z.number().nonnegative(),
  citizens: z.int().nonnegative(),
});
export type CounterReading = z.infer<typeof CounterReading>;

/**
 * `fixtures/funding/Counter.json` (ADR-018, amended 2026-11-13): RSI's two counters as RSI's own
 * funding page reads them: the latest reading, and the last one of an earlier UTC day. The News
 * workflow reads it about once an hour (`scripts/funding/counter.ts`), and the site puts it after
 * the wiki's daily snapshots, so the front page's figures are RSI's of the last hour rather than the
 * wiki's of the evening before. The earlier day's reading stands for a day the wiki's copied series
 * does not reach yet (the wiki records 20:00 UTC; the daily refresh copies it the next morning), so
 * no day is missing between the series and the latest reading.
 */
export const FundingCounter = z.strictObject({
  source: z.strictObject({
    name: z.literal("RSI"),
    /** The endpoint RSI's funding page reads its counters from. */
    url: z.url(),
    /** The funding page itself. */
    origin_url: z.url(),
  }),
  ...CounterReading.shape,
  /** The last reading on an earlier UTC day than `read_at`; null before there is one. */
  previous_day: CounterReading.nullable(),
});
export type FundingCounter = z.infer<typeof FundingCounter>;

/** The endpoint RSI's funding page reads its two counters from (ADR-018, amended 2026-11-13). */
export const COUNTER_URL =
  "https://robertsspaceindustries.com/api/stats/getCrowdfundStats";
/** RSI's funding page, where it shows them. */
export const COUNTER_ORIGIN_URL =
  "https://robertsspaceindustries.com/funding-goals";
/** What RSI's funding page asks for: the citizens ("fans") and the money ("funds"). */
export const COUNTER_BODY = { fans: true, funds: true } as const;

/**
 * The endpoint's answer, exactly as seen on 2026-11-13; `funds` is in cents. Anything else halts the
 * reader (CLAUDE.md section 5): the News workflow's step and the site's own live route alike.
 */
export const RsiCrowdfundAnswer = z.strictObject({
  success: z.literal(1),
  code: z.literal("OK"),
  msg: z.string(),
  data: z.strictObject({
    fans: z.int().nonnegative(),
    funds: z.int().nonnegative(),
  }),
});
export type RsiCrowdfundAnswer = z.infer<typeof RsiCrowdfundAnswer>;
