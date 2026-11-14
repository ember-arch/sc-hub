import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import {
  type LiveAnswer,
  LIVE_EVERY_SECONDS,
  readLiveAtMost,
} from "../../../../lib/funding-live-read";

/**
 * RSI's funding counter for the front page's live figures (ADR-018, amended 2026-11-13): one POST
 * to the endpoint RSI's own funding page reads, with the project User-Agent and contact address
 * (CLAUDE.md section 9), asked at most once a minute whatever reaches this route. Three things hold
 * it there:
 * - the route is static and regenerated at most once a minute, so readers are answered from
 *   Vercel's cache;
 * - a good read is kept a minute in Next's data cache, which Vercel shares across regions, so a
 *   request that skips the route's cache gets the kept answer;
 * - each server instance asks RSI at most once a minute, even when the data cache misses.
 * Without SC_HUB_CONTACT_EMAIL it asks nothing, so the CI build asks nothing. A failed read answers
 * 503 at run time, so Vercel keeps serving the last good answer and tries again shortly; at build
 * time it answers 200, since an error status there would make the route render on every request.
 */
export const dynamic = "force-static";
export const revalidate = 60;

/** Thrown inside the cache so a failure is never kept as the answer. */
class LiveReadFailed extends Error {}

const cachedRead = unstable_cache(
  async (): Promise<LiveAnswer> => {
    const answer = await readLiveAtMost(
      (url, init) => globalThis.fetch(url, init),
      process.env["SC_HUB_CONTACT_EMAIL"],
      () => new Date(),
    );
    if (!answer.ok && answer.reason !== "no contact address") {
      throw new LiveReadFailed(answer.reason);
    }
    return answer;
  },
  ["funding-live"],
  { revalidate: LIVE_EVERY_SECONDS },
);

export async function GET(): Promise<Response> {
  const runId = randomUUID();
  const started = Date.now();
  let body: LiveAnswer;
  try {
    body = await cachedRead();
  } catch (error) {
    body = {
      ok: false,
      reason: error instanceof Error ? error.message || error.name : "failed",
    };
  }
  // One line per run in Vercel's logs, the same shape as the workers' events (section 6).
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "funding-live",
      ok: body.ok,
      ...(body.ok ? { read_at: body.read_at } : { reason: body.reason }),
      duration_ms: Date.now() - started,
    }),
  );
  const building = process.env["NEXT_PHASE"] === "phase-production-build";
  const failed = !body.ok && body.reason !== "no contact address";
  return Response.json(body, { status: failed && !building ? 503 : 200 });
}
