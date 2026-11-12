import { z } from "zod";
import { NewsWorkflowRun } from "./news-clock.js";

/**
 * The refresh clock (ADR-056). GitHub starts the daily refresh's 06:23 UTC schedule hours late
 * when its queues are busy (15:27 on 12 Nov 2026, 14:35 the day before), so the Vercel cron job
 * that already starts the News workflow (ADR-053) starts the refresh at 06:23 too, through the same
 * workflow-dispatch API and token. The workflow's schedule stays as the backup and stands aside
 * when a dispatched run was created on the same UTC date. This module is the clock's decision,
 * free of I/O so the unit suite can pin it; a test checks the gate job in
 * .github/workflows/refresh.yml keys on the same date.
 *
 * Both rules count runs by UTC date, not by a rolling window: a run started by hand in the evening
 * is that day's refresh, and the next morning's clock still runs. With windows of twelve and twenty
 * hours, a hand run at 20:00 held back both the clock at 06:23 and the late schedule at 15:00 the
 * next day, and the site lost a day.
 */

export const REFRESH_WORKFLOW = "refresh.yml";

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

/** The UTC date of an instant, `YYYY-MM-DD`, the prefix GitHub's `created_at` carries. */
export function utcDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Whether the clock starts the refresh now, given the workflow's latest runs (newest first, any
 * event): never while any run is queued or under way, however it was started, since a refresh
 * asks RSI and the wiki for thousands of pages and a second one behind it would ask again; and
 * never when a dispatched run that was not cancelled was created on today's UTC date (a cron call
 * delivered twice, or a run started by hand before 06:23). A dispatched run that failed still
 * counts as the day's run, as a scheduled one that failed always has.
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
  const today = utcDate(now);
  const ran = runs.find(
    (run) =>
      run.event === "workflow_dispatch" &&
      run.conclusion !== "cancelled" &&
      run.created_at.startsWith(today),
  );
  if (ran !== undefined) {
    return {
      dispatch: false,
      reason: `run ${ran.id} was started at ${ran.created_at}, already today (UTC)`,
    };
  }
  return { dispatch: true };
}
