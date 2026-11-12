import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REFRESH_CLOCK_GAP_MS,
  REFRESH_SCHEDULE_STANDS_ASIDE_MS,
  type RefreshWorkflowRun,
  decideRefreshClock,
} from "../refresh-clock.js";

// ADR-056: the refresh clock's decision and the span the workflow's gate uses.

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
  it("starts the refresh when nothing ran today", () => {
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

  it("starts nothing when a dispatched run began within the gap, a cron call delivered twice or a hand start", () => {
    const decision = decideRefreshClock(
      [run({ created_at: "2026-11-13T06:23:01Z" })],
      new Date("2026-11-13T06:23:40Z"),
    );
    expect(decision.dispatch).toBe(false);
    expect(
      decideRefreshClock([run({ created_at: "2026-11-13T01:00:00Z" })], now)
        .dispatch,
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
});

describe("the workflow's gate", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/refresh.yml", import.meta.url),
    "utf8",
  );

  it("stands a scheduled run aside for REFRESH_SCHEDULE_STANDS_ASIDE_MS after a dispatched one", () => {
    // Long enough to cover a schedule run as late as the evening, short of the next day's clock.
    expect(REFRESH_SCHEDULE_STANDS_ASIDE_MS).toBeGreaterThan(16 * 3_600_000);
    expect(REFRESH_SCHEDULE_STANDS_ASIDE_MS).toBeLessThan(24 * 3_600_000);
    expect(REFRESH_CLOCK_GAP_MS).toBeLessThan(24 * 3_600_000);
    expect(workflow).toContain(
      `-lt ${REFRESH_SCHEDULE_STANDS_ASIDE_MS / 1000} ]`,
    );
  });

  it("runs the refresh job only when the gate lets it go", () => {
    expect(workflow).toContain("needs: gate");
    expect(workflow).toContain("if: needs.gate.outputs.go == 'true'");
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
