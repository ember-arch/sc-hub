import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type RefreshWorkflowRun,
  decideRefreshClock,
  utcDate,
} from "../refresh-clock.js";

// ADR-056: the refresh clock's decision and the workflow's gate.

const now = new Date("2026-11-13T06:23:00Z");
const run = (
  over: Partial<RefreshWorkflowRun> & Pick<RefreshWorkflowRun, "created_at">,
): RefreshWorkflowRun => ({
  id: 1,
  event: "workflow_dispatch",
  status: "completed",
  conclusion: "success",
  updated_at: over.created_at,
  ...over,
});

describe("decideRefreshClock", () => {
  it("starts the refresh when nothing was dispatched today", () => {
    expect(decideRefreshClock([], now)).toEqual({ dispatch: true });
    expect(
      decideRefreshClock(
        [
          run({ created_at: "2026-11-12T06:23:05Z" }),
          run({ event: "schedule", created_at: "2026-11-12T15:27:52Z" }),
        ],
        now,
      ),
    ).toEqual({ dispatch: true });
  });

  it("still runs the morning after a refresh started by hand last evening", () => {
    // The case a rolling window lost: a hand run at 20:00 is the previous day's refresh.
    expect(
      decideRefreshClock([run({ created_at: "2026-11-12T20:00:00Z" })], now),
    ).toEqual({ dispatch: true });
    expect(
      decideRefreshClock(
        [run({ created_at: "2026-11-12T23:59:59Z" })],
        new Date("2026-11-13T00:00:00Z"),
      ),
    ).toEqual({ dispatch: true });
  });

  it.each(["queued", "in_progress", "waiting", "pending", null])(
    "starts nothing while any run is %s, a scheduled one too",
    (status) => {
      const decision = decideRefreshClock(
        [
          run({
            event: "schedule",
            status,
            created_at: "2026-11-12T15:00:00Z",
          }),
        ],
        now,
      );
      expect(decision.dispatch).toBe(false);
    },
  );

  it("starts nothing when a dispatched run was created today: a cron call delivered twice, or a hand start before 06:23", () => {
    expect(
      decideRefreshClock(
        [run({ created_at: "2026-11-13T06:23:01Z" })],
        new Date("2026-11-13T06:23:40Z"),
      ).dispatch,
    ).toBe(false);
    expect(
      decideRefreshClock([run({ created_at: "2026-11-13T00:00:00Z" })], now)
        .dispatch,
    ).toBe(false);
    // A dispatched run that failed is still the day's run, as a failed scheduled one always was.
    expect(
      decideRefreshClock(
        [run({ conclusion: "failure", created_at: "2026-11-13T01:00:00Z" })],
        now,
      ).dispatch,
    ).toBe(false);
  });

  it("is not held back by a cancelled dispatched run, or by a scheduled run that finished", () => {
    expect(
      decideRefreshClock(
        [
          run({ conclusion: "cancelled", created_at: "2026-11-13T05:00:00Z" }),
          run({ event: "schedule", created_at: "2026-11-13T05:30:00Z" }),
        ],
        now,
      ),
    ).toEqual({ dispatch: true });
  });

  it("reads the UTC date GitHub's created_at starts with", () => {
    expect(utcDate(new Date("2026-11-13T23:59:59.999Z"))).toBe("2026-11-13");
    expect(utcDate(new Date("2026-11-13T00:00:00-08:00"))).toBe("2026-11-13");
  });
});

describe("the workflow's gate", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/refresh.yml", import.meta.url),
    "utf8",
  );

  it("stands a scheduled run aside only for a dispatched run created on the same UTC date", () => {
    expect(workflow).toContain("today=$(date -u +%F)");
    expect(workflow).toContain('startswith(\\"$today\\")');
    expect(workflow).toContain('.conclusion != \\"cancelled\\"');
    expect(workflow).toContain("event=workflow_dispatch");
  });

  it("runs the refresh job unless the gate said no, so a failed gate still refreshes", () => {
    expect(workflow).toContain("needs: gate");
    expect(workflow).toContain(
      "if: ${{ !cancelled() && needs.gate.outputs.go != 'false' }}",
    );
  });

  it("keeps the schedule the clock mirrors", () => {
    const vercel = JSON.parse(
      readFileSync(
        new URL("../../../apps/web/vercel.json", import.meta.url),
        "utf8",
      ),
    ) as { crons: { path: string; schedule: string }[] };
    const clock = vercel.crons.find((c) => c.path === "/api/cron/refresh");
    expect(clock?.schedule).toBe("23 6 * * *");
    expect(workflow).toContain(`- cron: "${clock?.schedule}"`);
  });
});
