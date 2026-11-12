import { randomUUID } from "node:crypto";
import {
  decideRefreshClock,
  NEWS_REPOSITORY,
  REFRESH_WORKFLOW,
  RefreshWorkflowRunList,
} from "schema";
import { userAgent } from "schema/site";
import { cronAuthorized } from "../../../../lib/cron-auth";

/**
 * The refresh clock (ADR-056): Vercel's cron calls this at 06:23 UTC (apps/web/vercel.json), and
 * it starts the daily refresh through GitHub's workflow-dispatch API unless a run is queued or under
 * way or one was started by dispatch earlier the same UTC day. It uses the news clock's
 * credentials (ADR-053): CRON_SECRET, which Vercel sends as a bearer token, and
 * NEWS_DISPATCH_TOKEN, the fine-grained token for this repository with Actions read and write only,
 * which covers every workflow in it. Without the token it answers and does nothing, and the
 * workflow's own schedule runs the refresh as before.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const API = `https://api.github.com/repos/${NEWS_REPOSITORY}/actions/workflows/${REFRESH_WORKFLOW}`;
const TIMEOUT_MS = 10_000;

export async function GET(request: Request): Promise<Response> {
  const runId = randomUUID();
  const answer = (status: number, body: Record<string, unknown>): Response => {
    // One line per call in Vercel's logs, the same shape as the workers' events (section 6).
    console.log(
      JSON.stringify({ run_id: runId, job: "refresh-clock", status, ...body }),
    );
    return Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  };
  // Trimmed, as in the news clock: a header value loses its surrounding whitespace in transit.
  const secret = process.env["CRON_SECRET"]?.trim() ?? "";
  if (secret === "") {
    return answer(503, { dispatched: false, reason: "CRON_SECRET is not set" });
  }
  if (!cronAuthorized(request.headers.get("authorization"), secret)) {
    return answer(401, { dispatched: false, reason: "unauthorized" });
  }
  const token = process.env["NEWS_DISPATCH_TOKEN"]?.trim();
  if (!token) {
    return answer(200, {
      dispatched: false,
      reason:
        "NEWS_DISPATCH_TOKEN is not set; the workflow's schedule runs the refresh",
    });
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": userAgent("refresh-clock", null),
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
    const runs = RefreshWorkflowRunList.parse(
      await listed.json(),
    ).workflow_runs;
    const decision = decideRefreshClock(runs, new Date());
    if (!decision.dispatch) {
      return answer(200, { dispatched: false, reason: decision.reason });
    }
    const started = await fetch(`${API}/dispatches`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main" }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!started.ok) {
      return answer(502, {
        dispatched: false,
        reason: `GitHub answered ${started.status} to the dispatch`,
      });
    }
    return answer(200, { dispatched: true });
  } catch (error) {
    return answer(502, {
      dispatched: false,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
