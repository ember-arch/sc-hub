import { z } from "zod";
import { NewsWorkflowRun } from "./news-clock.js";

/**
 * The refresh clock (ADR-056). GitHub starts the daily refresh's 06:23 UTC schedule hours late
 * when its queues are busy (15:27 on 12 Nov 2026, 14:35 the day before), so the Vercel cron job
 * that already starts the News workflow (ADR-053) starts the refresh at 06:23 too, through the same
 * workflow-dispatch API and token. The workflow's schedule stays as the backup and stands aside
 * when the clock already ran it that day. This module is the clock's decision, free of I/O so the
 * unit suite can pin it, and the span the workflow's gate job uses, which a test checks against
 * .github/workflows/refresh.yml.
 */

export const REFRESH_WORKFLOW = "refresh.yml";

/**
 * A scheduled run stands aside when a dispatched run was created within this long (the gate job
 * reads it). The schedule's run comes at 06:23 or, late, any time up to the evening; the clock's
 * started at 06:23, so the late one is always inside the span. When the clock has not run for a
 * day, the schedule's run goes as before.
 */
export const REFRESH_SCHEDULE_STANDS_ASIDE_MS = 20 * 60 * 60_000;

/**
 * The clock starts nothing when a dispatched run was created within this long: a cron call
 * delivered twice, or a run started by hand earlier that morning, already did the day's refresh.
 */
export const REFRESH_CLOCK_GAP_MS = 12 * 60 * 60_000;

/** The run fields the refresh clock reads: the news clock's, and how a finished run ended. */
export const RefreshWorkflowRun = NewsWorkflowRun.extend({
  /** null until the run completes; "cancelled" for a run that never did its work. */
  conclusion: z.string().nullable().optional(),
});
export type RefreshWorkflowRun = z.infer<typeof RefreshWorkflowRun>;

/** `GET /repos/{owner}/{repo}/actions/workflows/refresh.yml/runs`, the part the clock reads. */
export const RefreshWorkflowRunList = z.object({
  workflow_runs: z.array(RefreshWorkflowRun),
});

export type RefreshClockDecision =
  | { readonly dispatch: true }
  | { readonly dispatch: false; readonly reason: string };

/**
 * Whether the clock starts the refresh now, given the workflow's latest runs (newest first, any
 * event): never while any run is queued or under way, however it was started, since a refresh
 * asks RSI and the wiki for thousands of pages and a second one behind it would ask again; and
 * never when a dispatched run that was not cancelled was created within REFRESH_CLOCK_GAP_MS.
 */
export function decideRefreshClock(
  runs: readonly RefreshWorkflowRun[],
  now: Date,
): RefreshClockDecision {
  const busy = runs.find((run) => run.status !== "completed");
  if (busy !== undefined) {
    return {
      dispatch: false,
      reason: `run ${busy.id} is ${busy.status ?? "of no status"}`,
    };
  }
  const recent = runs.find(
    (run) =>
      run.event === "workflow_dispatch" &&
      run.conclusion !== "cancelled" &&
      now.getTime() - Date.parse(run.created_at) < REFRESH_CLOCK_GAP_MS,
  );
  if (recent !== undefined) {
    return {
      dispatch: false,
      reason: `run ${recent.id} was started at ${recent.created_at}, under ${REFRESH_CLOCK_GAP_MS / 3_600_000} hours ago`,
    };
  }
  return { dispatch: true };
}
