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
    "never starts one while a dispatched run is %s",
    (status) => {
      const decision = decideNewsClock(
        [
          run(3, status, "2026-11-12T05:00:00Z", "workflow_dispatch"),
          run(2, "completed", "2026-11-12T04:00:00Z"),
        ],
        new Date("2026-11-12T07:07:00Z"),
      );
      expect(decision.dispatch).toBe(false);
      expect(decision).toMatchObject({ reason: expect.stringContaining("3") });
    },
  );

  it("is not held back by a scheduled run under way, which most likely stands aside; the gate spaces the two if not", () => {
    expect(
      decideNewsClock(
        [run(3, "in_progress", "2026-11-12T07:06:50Z", "schedule")],
        new Date("2026-11-12T07:07:00Z"),
      ),
    ).toEqual({ dispatch: true, video_slot: "due" });
  });

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

  it("holds every run back for NEWS_SETTLE_MS after the latest end of the recent runs, and the whole span when it cannot tell", () => {
    const settle = NEWS_SETTLE_MS / 1000;
    expect(NEWS_SETTLE_MS).toBeGreaterThan(5 * 60_000);
    expect(workflow).toContain(`pause=$(( ${settle} - `);
    // The default, kept when the API or the date cannot be read.
    expect(workflow).toContain(`pause=${settle}\n`);
    // The latest end, not the newest-created run's (the list is in creation order).
    expect(workflow).toContain("status=completed&per_page=30");
    expect(workflow).toContain(".updated_at] | max");
  });

  it("runs the poll only on the gate's word: a failed gate never searches Spectrum unspaced", () => {
    expect(workflow).toContain("if: needs.gate.outputs.go == 'true'");
    expect(workflow).toContain(
      "NEWS_VIDEO_SLOT: ${{ needs.gate.outputs.video }}",
    );
  });

  it("cancels a run that stands aside, so the video check never takes it for a read", () => {
    expect(workflow).toContain('gh run cancel "$RUN_ID"');
    expect(workflow).toContain('.conclusion != \\"cancelled\\"');
    expect(workflow).toContain("'News, with the video feed'");
    expect(workflow).toContain('contains(\\"video feed\\")');
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
