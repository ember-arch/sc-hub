import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decideNewsClock,
  NEWS_SCHEDULE_STANDS_ASIDE_MS,
  NEWS_SETTLE_MS,
  type NewsWorkflowRun,
  NewsWorkflowRunList,
} from "../news-clock.js";

// ADR-053: the news clock starts the News workflow unless a run is queued or under way, and asks
// for the hour's YouTube feed in the first half of the hour only. The spacing after a run is the
// workflow's gate job, whose numbers are checked against the constants here.

const run = (
  id: number,
  status: string | null,
  updated_at: string,
  event = "schedule",
): NewsWorkflowRun => ({
  id,
  event,
  status,
  created_at: "2026-11-12T05:00:00Z",
  updated_at,
});

describe("decideNewsClock", () => {
  it("starts a run when none is under way, asking for the video feed at :07", () => {
    expect(
      decideNewsClock(
        [run(2, "completed", "2026-11-12T06:10:00Z")],
        new Date("2026-11-12T07:07:00Z"),
      ),
    ).toEqual({ dispatch: true, video_slot: "due" });
  });

  it("leaves the video feed alone at :37", () => {
    expect(
      decideNewsClock(
        [run(2, "completed", "2026-11-12T06:10:00Z")],
        new Date("2026-11-12T07:37:00Z"),
      ),
    ).toEqual({ dispatch: true, video_slot: "" });
  });

  it("starts a run when the workflow has never run", () => {
    expect(decideNewsClock([], new Date("2026-11-12T07:07:00Z")).dispatch).toBe(
      true,
    );
  });

  it.each(["queued", "in_progress", "waiting", "pending", "requested", null])(
    "never starts one while another is %s",
    (status) => {
      const decision = decideNewsClock(
        [
          run(3, status, "2026-11-12T05:00:00Z"),
          run(2, "completed", "2026-11-12T04:00:00Z"),
        ],
        new Date("2026-11-12T07:07:00Z"),
      );
      expect(decision.dispatch).toBe(false);
      expect(decision).toMatchObject({ reason: expect.stringContaining("3") });
    },
  );

  it("is not held back by a run that ended a moment ago, such as a scheduled run that stood aside: the gate spaces the runs", () => {
    expect(
      decideNewsClock(
        [run(3, "completed", "2026-11-12T07:06:30Z")],
        new Date("2026-11-12T07:07:00Z"),
      ).dispatch,
    ).toBe(true);
  });
});

describe("the workflow's gate", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/news.yml", import.meta.url),
    "utf8",
  );

  it("stands a scheduled run aside for NEWS_SCHEDULE_STANDS_ASIDE_MS after a dispatched one", () => {
    expect(NEWS_SCHEDULE_STANDS_ASIDE_MS).toBeGreaterThan(30 * 60_000);
    expect(workflow).toContain(`-lt ${NEWS_SCHEDULE_STANDS_ASIDE_MS / 1000} ]`);
  });

  it("holds every run back for NEWS_SETTLE_MS after the last one ended, longer than Spectrum's five minutes", () => {
    expect(NEWS_SETTLE_MS).toBeGreaterThan(5 * 60_000);
    expect(workflow).toContain(`pause=$(( ${NEWS_SETTLE_MS / 1000} - `);
  });

  it("lets the poll go when the gate fails, and only stops it on a stand-aside", () => {
    expect(workflow).toContain(
      "if: ${{ !cancelled() && needs.gate.outputs.go != 'false' }}",
    );
  });
});

describe("NewsWorkflowRunList", () => {
  it("reads GitHub's run list and keeps only the fields the clock needs", () => {
    const parsed = NewsWorkflowRunList.parse({
      total_count: 1,
      workflow_runs: [
        {
          id: 43150321245,
          name: "News",
          event: "schedule",
          status: "completed",
          conclusion: "success",
          created_at: "2026-11-12T03:45:33Z",
          updated_at: "2026-11-12T03:47:10Z",
        },
      ],
    });
    expect(parsed.workflow_runs[0]).toEqual({
      id: 43150321245,
      event: "schedule",
      status: "completed",
      created_at: "2026-11-12T03:45:33Z",
      updated_at: "2026-11-12T03:47:10Z",
    });
  });

  it("refuses a run without a time", () => {
    expect(
      NewsWorkflowRunList.safeParse({
        workflow_runs: [{ id: 1, event: "schedule", status: "completed" }],
      }).success,
    ).toBe(false);
  });
});
