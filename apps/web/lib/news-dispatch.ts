import { randomUUID } from "node:crypto";
import {
  decideNewsClock,
  NEWS_REPOSITORY,
  NEWS_WORKFLOW,
  NewsWorkflowRunList,
} from "schema";
import { userAgent } from "schema/site";
import { cronAuthorized } from "./cron-auth";

/**
 * What the news clocks share (ADR-053): Vercel's cron calls a route, which checks CRON_SECRET (sent
 * by Vercel as a bearer token) and starts the News workflow through GitHub's workflow-dispatch API
 * unless a dispatched run is queued or under way; the workflow's gate job spaces the runs after that
 * (NEWS_SETTLE_MS). It needs NEWS_DISPATCH_TOKEN, a fine-grained token for this repository with
 * Actions read and write only; without it the route answers and does nothing, and the workflow's
 * own schedule runs the news as before. `skip`, asked once the call is known to be Vercel's, names a
 * reason to start nothing this time, or null to go on.
 */

const API = `https://api.github.com/repos/${NEWS_REPOSITORY}/actions/workflows/${NEWS_WORKFLOW}`;
const TIMEOUT_MS = 10_000;

export interface NewsClockOptions {
  /** The log line's `job`, which tells the clocks apart in Vercel's logs. */
  readonly job: string;
  readonly skip?: (now: Date) => string | null;
  /**
   * Whether the run may take the hour's YouTube feed when it is due; false for a clock other than
   * the news clock, since the feed is read from the :07 run only (CLAUDE.md section 9, ADR-050).
   */
  readonly videoFeed?: boolean;
}

export async function startNews(
  request: Request,
  options: NewsClockOptions,
): Promise<Response> {
  const runId = randomUUID();
  const answer = (status: number, body: Record<string, unknown>): Response => {
    // One line per call in Vercel's logs, the same shape as the workers' events (section 6).
    console.log(
      JSON.stringify({ run_id: runId, job: options.job, status, ...body }),
    );
    return Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  };
  // Trimmed: a header value loses its surrounding whitespace in transit (RFC 9110), so a secret
  // stored with a stray space still matches what arrives.
  const secret = process.env["CRON_SECRET"]?.trim() ?? "";
  if (secret === "") {
    return answer(503, { dispatched: false, reason: "CRON_SECRET is not set" });
  }
  if (!cronAuthorized(request.headers.get("authorization"), secret)) {
    return answer(401, { dispatched: false, reason: "unauthorized" });
  }
  const skipped = options.skip?.(new Date()) ?? null;
  if (skipped !== null) {
    return answer(200, { dispatched: false, reason: skipped });
  }
  const token = process.env["NEWS_DISPATCH_TOKEN"]?.trim();
  if (!token) {
    return answer(200, {
      dispatched: false,
      reason:
        "NEWS_DISPATCH_TOKEN is not set; the workflow's schedule runs the news",
    });
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": userAgent("news-clock", null),
    "X-GitHub-Api-Version": "2022-11-28",
  };
  try {
    const listed = await fetch(`${API}/runs?per_page=10`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!listed.ok) {
      return answer(502, {
        dispatched: false,
        reason: `GitHub answered ${listed.status} to the run list`,
      });
    }
    const runs = NewsWorkflowRunList.parse(await listed.json()).workflow_runs;
    const decision = decideNewsClock(runs, new Date());
    if (!decision.dispatch) {
      return answer(200, { dispatched: false, reason: decision.reason });
    }
    const videoSlot = options.videoFeed === false ? "" : decision.video_slot;
    const started = await fetch(`${API}/dispatches`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: "main",
        inputs: { video_slot: videoSlot },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!started.ok) {
      return answer(502, {
        dispatched: false,
        reason: `GitHub answered ${started.status} to the dispatch`,
      });
    }
    return answer(200, { dispatched: true, video_slot: videoSlot });
  } catch (error) {
    return answer(502, {
      dispatched: false,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
