/**
 * RSI's own funding counters (ADR-018, amended 2026-11-13): the answer of the endpoint RSI's
 * funding page reads, mapped onto `FundingCounter`. Pure apart from the injected `fetch`, so the
 * unit tests run it on a committed sample with no network. An answer that is not exactly the shape
 * seen on 2026-11-13 halts the run (CLAUDE.md section 5), and so does a reading no cumulative
 * counter could give.
 */

import type { FundingCounter, FundingSnapshot } from "schema";
import { z } from "zod";
import { IMPLAUSIBLE_SHARE } from "./map.js";

export const COUNTER_URL =
  "https://robertsspaceindustries.com/api/stats/getCrowdfundStats";
export const COUNTER_ORIGIN_URL =
  "https://robertsspaceindustries.com/funding-goals";
/** What RSI's funding page asks for: the citizens ("fans") and the money ("funds"). */
export const COUNTER_BODY = { fans: true, funds: true } as const;
/** CLAUDE.md section 9: one request every 5 seconds to RSI, the first one too (the job's polls have just asked). */
export const RSI_SPACING_MS = 5_000;

/** The endpoint's answer, exactly as seen; `funds` is in cents. */
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

/**
 * The new reading on top of the one on file: the earlier day's reading is the one on file when it
 * was taken on an earlier UTC day, and otherwise stays what the one on file kept.
 */
export function mapCounter(
  answer: RsiCrowdfundAnswer,
  readAt: Date,
  previous: FundingCounter | null,
): FundingCounter {
  const read_at = readAt.toISOString();
  const previous_day =
    previous === null
      ? null
      : previous.read_at.slice(0, 10) < read_at.slice(0, 10)
        ? {
            read_at: previous.read_at,
            funds_usd: previous.funds_usd,
            citizens: previous.citizens,
          }
        : previous.previous_day;
  return {
    source: { name: "RSI", url: COUNTER_URL, origin_url: COUNTER_ORIGIN_URL },
    read_at,
    funds_usd: answer.data.funds / 100,
    citizens: answer.data.fans,
    previous_day,
  };
}

/**
 * Why a reading cannot stand, or null when it can: ADR-018's rule, a counter below half the last
 * snapshot's, for either figure. RSI's corrections of a few percent pass, as they do in the series.
 */
export function implausible(
  counter: FundingCounter,
  latest: FundingSnapshot | null,
): string | null {
  if (latest === null) return null;
  if (counter.funds_usd < latest.funds_usd * IMPLAUSIBLE_SHARE) {
    return `funds ${counter.funds_usd} is below half of ${latest.day}'s ${latest.funds_usd}`;
  }
  if (
    latest.citizens !== null &&
    counter.citizens < latest.citizens * IMPLAUSIBLE_SHARE
  ) {
    return `citizens ${counter.citizens} is below half of ${latest.day}'s ${latest.citizens}`;
  }
  return null;
}

/**
 * How old the committed reading may grow before the News workflow reads RSI again on a run that
 * commits nothing else. Under an hour, so the runs at 7 and 37 past the hour (ADR-053) read it once
 * an hour even when one starts a few minutes late; the reading alone then redeploys the site at
 * most about once an hour.
 */
export const COUNTER_EVERY_MS = 55 * 60_000;

export function counterDue(
  previous: FundingCounter | null,
  now: Date,
): boolean {
  if (previous === null) return true;
  return now.getTime() - Date.parse(previous.read_at) >= COUNTER_EVERY_MS;
}

export interface CounterDeps {
  readonly fetch: typeof fetch;
  readonly sleep: (ms: number) => Promise<unknown>;
  readonly now: () => Date;
  readonly userAgent: string;
}

/**
 * One request to RSI's counter endpoint, after the polite spacing, and the reading it gives on top
 * of the one on file. Throws, writing nothing, on anything but a 200 with the exact answer shape
 * (a redirect is not followed: the address has moved, and that is for a person to look at) and on
 * an implausible reading. Returns the answer as served too, for `--save-sample`.
 */
export async function readCounter(
  previous: FundingCounter | null,
  latestSnapshot: FundingSnapshot | null,
  deps: CounterDeps,
): Promise<{ counter: FundingCounter; answer: unknown }> {
  await deps.sleep(RSI_SPACING_MS);
  const response = await deps.fetch(COUNTER_URL, {
    method: "POST",
    headers: {
      "User-Agent": deps.userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(COUNTER_BODY),
    redirect: "manual",
  });
  const readAt = deps.now();
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`RSI answered ${response.status}`);
  }
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`RSI's answer is not JSON: ${text.slice(0, 120)}`);
  }
  const counter = mapCounter(RsiCrowdfundAnswer.parse(json), readAt, previous);
  const why = implausible(counter, latestSnapshot);
  if (why !== null) throw new Error(`implausible reading: ${why}`);
  return { counter, answer: json };
}
