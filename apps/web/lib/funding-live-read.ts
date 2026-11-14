import { COUNTER_BODY, COUNTER_URL, RsiCrowdfundAnswer } from "schema";
import { userAgent } from "schema/site";

/**
 * One read of RSI's funding counter for the site's live route (ADR-018, amended 2026-11-13), with
 * an injected `fetch` so the unit tests run it with no network. Without a contact address it asks
 * nothing; a refusal or an answer of any other shape than the one seen (CLAUDE.md section 5) gives
 * `{ ok: false }`.
 */

const TIMEOUT_MS = 8_000;

export type LiveAnswer =
  | {
      readonly ok: true;
      readonly read_at: string;
      readonly funds_usd: number;
      readonly citizens: number;
    }
  | { readonly ok: false; readonly reason: string };

export async function readLive(
  fetchImpl: typeof fetch,
  contact: string | undefined,
  now: () => Date,
): Promise<LiveAnswer> {
  const address = contact?.trim() ?? "";
  if (address === "") return { ok: false, reason: "no contact address" };
  const response = await fetchImpl(COUNTER_URL, {
    method: "POST",
    headers: {
      "User-Agent": userAgent("site", address),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(COUNTER_BODY),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    return { ok: false, reason: `RSI answered ${response.status}` };
  }
  const parsed = RsiCrowdfundAnswer.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) return { ok: false, reason: "unknown answer shape" };
  return {
    ok: true,
    read_at: now().toISOString(),
    funds_usd: parsed.data.data.funds / 100,
    citizens: parsed.data.data.fans,
  };
}

/** The least time between two reads of RSI's counter by the site (CLAUDE.md section 9). */
export const LIVE_EVERY_SECONDS = 60;

export interface ReadFloor {
  last: { readonly at: number; readonly answer: LiveAnswer } | null;
  pending: Promise<LiveAnswer> | null;
}

/** This server instance's last read, so it never asks RSI twice in a minute. */
const instanceFloor: ReadFloor = { last: null, pending: null };

/**
 * `readLive`, but at most once a minute per server instance: inside that minute it gives the last
 * answer, good or failed, without asking RSI, and callers arriving during a read share it. A thrown
 * error (a timeout, the network) counts as a failed answer.
 */
export async function readLiveAtMost(
  fetchImpl: typeof fetch,
  contact: string | undefined,
  now: () => Date,
  floor: ReadFloor = instanceFloor,
): Promise<LiveAnswer> {
  const at = now().getTime();
  if (floor.last !== null && at - floor.last.at < LIVE_EVERY_SECONDS * 1000) {
    return floor.last.answer;
  }
  if (floor.pending !== null) return floor.pending;
  const read = readLive(fetchImpl, contact, now)
    .catch((error: unknown): LiveAnswer => ({
      ok: false,
      reason: error instanceof Error ? error.name : "failed",
    }))
    .then((answer) => {
      floor.last = { at, answer };
      floor.pending = null;
      return answer;
    });
  floor.pending = read;
  return read;
}
