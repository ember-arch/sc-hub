import { describe, expect, it } from "vitest";
import { NEWS_WINDOW_START, inNewsWindow } from "../news-window.js";

// ADR-031: the window opens on the first day of DefenseCon 2956, as an instant.

describe("inNewsWindow", () => {
  it("opens at UTC midnight on 14 May 2026", () => {
    expect(NEWS_WINDOW_START).toBe("2026-05-14T00:00:00.000Z");
    expect(inNewsWindow("2026-05-14T00:00:00.000Z")).toBe(true);
    expect(inNewsWindow("2026-05-13T23:59:59.999Z")).toBe(false);
    expect(inNewsWindow("2026-11-10T14:53:13.000Z")).toBe(true);
  });

  it("reads an offset as the instant it names, not as text", () => {
    // 01:00 at +02:00 is 23:00 UTC the day before: out.
    expect(inNewsWindow("2026-05-14T01:00:00+02:00")).toBe(false);
    // 22:00 at -05:00 is 03:00 UTC the next day: in.
    expect(inNewsWindow("2026-05-13T22:00:00-05:00")).toBe(true);
  });

  it("keeps out what is not a time", () => {
    expect(inNewsWindow("")).toBe(false);
    expect(inNewsWindow("yesterday")).toBe(false);
  });
});
