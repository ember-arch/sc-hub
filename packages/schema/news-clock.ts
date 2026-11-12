import { z } from "zod";

/**
 * The news clock (ADR-053). GitHub drops most scheduled runs when its queues are busy (two of
 * about nineteen ran on 11-12 Nov 2026), so a Vercel cron job starts the News workflow at seven and
 * thirty-seven past the hour through GitHub's workflow-dispatch API, and the workflow's own
 * schedule stays as the backup, standing aside while the clock is running. This module is the
 * clock's decision, kept free of I/O so the unit suite can pin it, and the two spans the
 * workflow's gate job uses, which a test checks against .github/workflows/news.yml.
 */

export const NEWS_REPOSITORY = "ember-arch/sc-hub";
export const NEWS_WORKFLOW = "news.yml";

/**
 * How long after the last completed run ended the workflow's gate holds a new run back, for every
 * run however it was started: Spectrum's search is asked at most once every five minutes
 * (ADR-027), the poll's own spacing holds only within one run, and the concurrency group starts a
 * queued run the moment the last one ends. A minute over the five for the run's own steps.
 */
export const NEWS_SETTLE_MS = 6 * 60_000;

/**
 * A scheduled run stands aside when a dispatched run started within this long (the gate job reads
 * it): with the clock running every thirty minutes, the schedule never doubles a run, and an hour
 * after the clock last started one, the schedule takes over again by itself.
 */
export const NEWS_SCHEDULE_STANDS_ASIDE_MS = 60 * 60_000;

/** The fields of a workflow run the clock reads, as GitHub's REST API returns them. */
export const NewsWorkflowRun = z.object({
  id: z.number().int(),
  event: z.string(),
  /** "completed" once it has ended; queued, waiting, pending, requested or in_progress before. */
  status: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export type NewsWorkflowRun = z.infer<typeof NewsWorkflowRun>;

/** `GET /repos/{owner}/{repo}/actions/workflows/{file}/runs`, the part the clock reads. */
export const NewsWorkflowRunList = z.object({
  workflow_runs: z.array(NewsWorkflowRun),
});

export type NewsClockDecision =
  | {
      readonly dispatch: true;
      /** "due" in the first half of the hour: the hour's one YouTube feed (ADR-050). */
      readonly video_slot: "due" | "";
    }
  | { readonly dispatch: false; readonly reason: string };

/**
 * Whether the clock starts a run now, given the workflow's latest runs (newest first, any event):
 * never while another is queued or under way, since that run already covers the slot and a second
 * would only queue behind it. The spacing after a run ends is the gate's (NEWS_SETTLE_MS), so a
 * scheduled run that stood aside a minute ago costs the clock nothing.
 */
export function decideNewsClock(
  runs: readonly NewsWorkflowRun[],
  now: Date,
): NewsClockDecision {
  const busy = runs.find((run) => run.status !== "completed");
  if (busy !== undefined) {
    return {
      dispatch: false,
      reason: `run ${busy.id} is ${busy.status ?? "of no status"}`,
    };
  }
  return {
    dispatch: true,
    video_slot: now.getUTCMinutes() < 30 ? "due" : "",
  };
}
