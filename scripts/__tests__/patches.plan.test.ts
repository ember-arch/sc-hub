import { describe, expect, it } from "vitest";
import { looksIncomplete, planBuilds } from "../patches/plan.js";

// Which builds a patches run fetches and when one looks half-imported (ADR-049).

const v = (code: string) => ({ code });

describe("planBuilds", () => {
  const listed = [
    v("4.10.2-LIVE.12881860"),
    v("4.6.0-LIVE.11218823"),
    v("4.6.0-LIVE.11135423"),
    v("4.5.0-LIVE.10966564"),
  ];

  it("fetches the oldest missing build first, so an older build of a version never lands after a newer one", () => {
    // Both 4.6.0 builds missing with a cap of one: the older goes first and keeps "4.6.0".
    expect(
      planBuilds(listed, new Set(["4.5.0-LIVE.10966564"]), { max: 1 }).map(
        (b) => b.code,
      ),
    ).toEqual(["4.6.0-LIVE.11135423"]);
    expect(
      planBuilds(
        listed,
        new Set(["4.5.0-LIVE.10966564", "4.6.0-LIVE.11135423"]),
      ).map((b) => b.code),
    ).toEqual(["4.6.0-LIVE.11218823", "4.10.2-LIVE.12881860"]);
  });

  it("never plans a build on file, whatever it is asked for", () => {
    expect(
      planBuilds(listed, new Set(["4.10.2-LIVE.12881860"]), {
        only: ["4.10.2-LIVE.12881860"],
      }),
    ).toEqual([]);
    expect(
      planBuilds(listed, new Set(), { only: ["4.10.2-LIVE.12881860"] }).map(
        (b) => b.code,
      ),
    ).toEqual(["4.10.2-LIVE.12881860"]);
  });
});

describe("looksIncomplete", () => {
  const newest = { code: "4.8.0-LIVE.11825000", vehicles: 288, parts: 971 };

  it("does not take a ship leaving the ship matrix for a gap (4.8.0 to 4.8.1)", () => {
    // 4.8.1 held 236 ships against 4.8.0's 279, with 52 listed without figures: 288 listed.
    expect(
      looksIncomplete(
        { code: "4.8.1-LIVE.11952564", vehicles: 236 + 52, parts: 971 },
        newest,
      ),
    ).toBe(false);
  });

  it("halts on a newer build that lists under nine tenths of the vehicles or parts", () => {
    expect(
      looksIncomplete(
        { code: "4.8.1-LIVE.11952564", vehicles: 200, parts: 971 },
        newest,
      ),
    ).toBe(true);
    expect(
      looksIncomplete(
        { code: "4.8.1-LIVE.11952564", vehicles: 288, parts: 500 },
        newest,
      ),
    ).toBe(true);
  });

  it("judges only builds newer than every build on file", () => {
    expect(
      looksIncomplete(
        { code: "4.7.0-LIVE.1", vehicles: 10, parts: 10 },
        newest,
      ),
    ).toBe(false);
    expect(
      looksIncomplete({ code: "4.8.1-LIVE.2", vehicles: 1, parts: 1 }, null),
    ).toBe(false);
  });
});
