import { describe, expect, it } from "vitest";
import {
  SHOW_CLOCK_KEEP_MS,
  SHOW_CLOCK_LATE_TRIES,
  SHOW_CLOCK_MAX_TRIES,
  SHOW_CLOCK_QUICK_MS,
  SHOW_CLOCK_QUICK_TRIES,
  SHOW_CLOCK_SLOW_MS,
  type ShowClockStep,
  showClockStep,
} from "../app/show-clock";

// ADR-057, amended 2026-11-15: when an open page asks the site for itself again after a show's day
// changes. The clock's steps are pure, so the tests walk them with a fake "now".

const DUE = Date.parse("2026-11-16T16:00:00Z");
const MINUTE = 60_000;

/**
 * Walks the clock from `start` (the browser's time) until it stops or `until`, asking as it says;
 * `answered` is the browser time at which a page with a later change arrives, which stops it.
 */
function walk(
  start: number,
  until: number,
  answered = Number.POSITIVE_INFINITY,
): { asks: number[]; stopped: boolean } {
  const asks: number[] = [];
  let now = start;
  let tries = 0;
  while (now <= until) {
    if (asks.length > 0 && asks.at(-1)! >= answered)
      return { asks, stopped: true };
    const step: ShowClockStep = showClockStep(DUE, now, tries);
    if (step.kind === "stop") return { asks, stopped: true };
    if (step.kind === "wait") {
      now += step.ms;
      continue;
    }
    asks.push(now);
    tries += 1;
    now += step.then;
  }
  return { asks, stopped: false };
}

describe("when an open page asks for itself", () => {
  it("waits for the change, then a second more", () => {
    expect(showClockStep(DUE, DUE - 10 * MINUTE, 0)).toEqual({
      kind: "wait",
      ms: 10 * MINUTE + 1_000,
    });
    expect(showClockStep(DUE, DUE, 0)).toMatchObject({ kind: "ask" });
  });

  it("asks quickly at first, then once a minute", () => {
    const { asks } = walk(DUE - MINUTE, DUE + 20 * MINUTE);
    expect(asks[0]).toBe(DUE + 1_000);
    const gaps = asks.slice(1).map((t, i) => t - asks[i]!);
    expect(gaps.slice(0, SHOW_CLOCK_QUICK_TRIES - 1)).toEqual(
      Array(SHOW_CLOCK_QUICK_TRIES - 1).fill(SHOW_CLOCK_QUICK_MS),
    );
    expect(
      gaps
        .slice(SHOW_CLOCK_QUICK_TRIES - 1)
        .every((g) => g === SHOW_CLOCK_SLOW_MS),
    ).toBe(true);
  });

  it("stops half an hour past the change, never more than its cap", () => {
    const { asks, stopped } = walk(DUE - MINUTE, DUE + 3 * 60 * MINUTE);
    expect(stopped).toBe(true);
    expect(asks.at(-1)! - DUE).toBeLessThanOrEqual(
      SHOW_CLOCK_KEEP_MS + SHOW_CLOCK_SLOW_MS,
    );
    expect(asks.length).toBeLessThanOrEqual(SHOW_CLOCK_MAX_TRIES);
  });

  it("stops once the new page arrives", () => {
    const { asks, stopped } = walk(
      DUE - MINUTE,
      DUE + 60 * MINUTE,
      DUE + 21_000,
    );
    expect(stopped).toBe(true);
    expect(asks).toHaveLength(2);
  });

  it("keeps asking while a browser's clock runs ten minutes fast", () => {
    // The site changes at DUE; this browser reads DUE at ten minutes before, so the site's change
    // comes at its DUE + 10 minutes. It still asks within a minute of then.
    const { asks, stopped } = walk(DUE - MINUTE, DUE + 11 * MINUTE);
    expect(stopped).toBe(false);
    expect(asks.some((t) => t >= DUE + 10 * MINUTE)).toBe(true);
  });

  it("asks a few times for a page already long stale when it opened, then stops", () => {
    const { asks, stopped } = walk(
      DUE + 2 * 60 * MINUTE,
      DUE + 3 * 60 * MINUTE,
    );
    expect(stopped).toBe(true);
    expect(asks).toHaveLength(SHOW_CLOCK_LATE_TRIES);
  });
});
