import { describe, expect, it } from "vitest";
import {
  decideNewsClock,
  NEWS_SCHEDULE_STANDS_ASIDE_MS,
  NEWS_SETTLE_MS,
  type NewsWorkflowRun,
  NewsWorkflowRunList,
} from "../news-clock.js";

// ADR-053: the news clock starts the News workflow unless a run is under way or one ended under
// six minutes ago, and asks for the hour's YouTube feed in the first half of the hour only.

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
  it("starts a run when the last one ended long ago, asking for the video feed at :07", () => {
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

  it("waits six minutes after the last run ended, whichever run ended last", () => {
    const now = new Date("2026-11-12T07:07:00Z");
    const justUnder = new Date(
      now.getTime() - NEWS_SETTLE_MS + 1000,
    ).toISOString();
    const justOver = new Date(
      now.getTime() - NEWS_SETTLE_MS - 1000,
    ).toISOString();
    expect(
      decideNewsClock(
        [
          run(3, "completed", "2026-11-12T05:00:00Z"),
          run(2, "completed", justUnder),
        ],
        now,
      ).dispatch,
    ).toBe(false);
    expect(decideNewsClock([run(3, "completed", justOver)], now).dispatch).toBe(
      true,
    );
  });

  it("keeps the schedule's stand-aside longer than the clock's half hour, so it never doubles a run", () => {
    expect(NEWS_SCHEDULE_STANDS_ASIDE_MS).toBeGreaterThan(30 * 60_000);
    expect(NEWS_SETTLE_MS).toBeGreaterThan(5 * 60_000);
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
