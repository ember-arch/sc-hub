import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FundingSeries } from "schema";
import { describe, expect, it } from "vitest";
import {
  WikiStatsPage,
  dropImplausible,
  findGaps,
  mapSnapshots,
} from "../funding/map.js";

// ADR-018: the stats mapper on the committed API sample; no network.

const here = dirname(fileURLToPath(import.meta.url));
const fundingDir = join(here, "..", "..", "fixtures", "funding");
const page = WikiStatsPage.parse(
  JSON.parse(
    readFileSync(join(fundingDir, "samples", "stats-page-1.json"), "utf8"),
  ),
);

describe("mapSnapshots", () => {
  it("keeps one row per day, the latest, ascending, with cents kept", () => {
    const snaps = mapSnapshots(page.data);
    expect(snaps.length).toBeLessThanOrEqual(page.data.length);
    expect(new Set(snaps.map((s) => s.day)).size).toBe(snaps.length);
    for (let i = 1; i < snaps.length; i += 1) {
      expect(
        (snaps[i]?.day ?? "").localeCompare(snaps[i - 1]?.day ?? ""),
      ).toBeGreaterThan(0);
    }
    const first = page.data.at(-1);
    const mapped = snaps[0];
    expect(mapped?.funds_usd).toBe(Number(first?.funds));
    expect(mapped?.citizens).toBe(first?.fans);
  });

  it("takes the later reading when two fall on one day", () => {
    const rows = [
      {
        funds: "10.00",
        fans: 1,
        fleet: 1,
        timestamp: "2020-01-01T20:00:00.000000Z",
      },
      {
        funds: "12.50",
        fans: 2,
        fleet: 2,
        timestamp: "2020-01-01T22:00:00.000000Z",
      },
      {
        funds: "9.00",
        fans: 1,
        fleet: 1,
        timestamp: "2019-12-31T20:00:00.000000Z",
      },
    ];
    expect(mapSnapshots(rows)).toEqual([
      {
        day: "2019-12-31",
        recorded_at: rows[2]?.timestamp,
        funds_usd: 9,
        citizens: 1,
      },
      {
        day: "2020-01-01",
        recorded_at: rows[1]?.timestamp,
        funds_usd: 12.5,
        citizens: 2,
      },
    ]);
  });

  it("reads a zero citizen count before August 2013 as unknown, not zero", () => {
    const [early, later] = mapSnapshots([
      {
        funds: "1.00",
        fans: 0,
        fleet: 0,
        timestamp: "2012-11-13T20:00:00.000000Z",
      },
      {
        funds: "2.00",
        fans: 0,
        fleet: 0,
        timestamp: "2013-09-01T20:00:00.000000Z",
      },
    ]);
    expect(early?.citizens).toBeNull();
    expect(later?.citizens).toBe(0);
  });

  it("halts on a row of another shape", () => {
    expect(() =>
      WikiStatsPage.parse({
        data: [
          {
            funds: "1",
            fans: 1,
            fleet: 1,
            timestamp: "2020-01-01T20:00:00Z",
            extra: 1,
          },
        ],
        meta: { current_page: 1, last_page: 1 },
      }),
    ).toThrow();
    expect(() =>
      WikiStatsPage.parse({
        data: [
          {
            funds: "one",
            fans: 1,
            fleet: 1,
            timestamp: "2020-01-01T20:00:00Z",
          },
        ],
        meta: { current_page: 1, last_page: 1 },
      }),
    ).toThrow();
  });
});

describe("dropImplausible", () => {
  it("drops a total that fell to a fraction and keeps a small correction", () => {
    const snaps = mapSnapshots([
      { funds: "100.00", fans: 1, fleet: 1, timestamp: "2020-01-01T20:00:00Z" },
      { funds: "0.00", fans: 1, fleet: 1, timestamp: "2020-01-02T20:00:00Z" },
      { funds: "95.00", fans: 1, fleet: 1, timestamp: "2020-01-03T20:00:00Z" },
      { funds: "110.00", fans: 1, fleet: 1, timestamp: "2020-01-04T20:00:00Z" },
    ]);
    const { kept, dropped } = dropImplausible(snaps);
    expect(kept.map((s) => s.day)).toEqual([
      "2020-01-01",
      "2020-01-03",
      "2020-01-04",
    ]);
    expect(dropped).toEqual([
      { day: "2020-01-02", funds_usd: 0, previous_funds_usd: 100 },
    ]);
  });

  it("matches the committed fixture's dropped list", () => {
    const series = FundingSeries.parse(
      JSON.parse(readFileSync(join(fundingDir, "Funding.json"), "utf8")),
    );
    expect(series.source.dropped).toEqual([
      {
        day: "2021-06-09",
        funds_usd: 0,
        previous_funds_usd: expect.any(Number),
      },
    ]);
  });
});

describe("findGaps", () => {
  it("lists missing stretches longest first", () => {
    const snaps = mapSnapshots([
      { funds: "1", fans: 1, fleet: 1, timestamp: "2020-01-01T20:00:00Z" },
      { funds: "1", fans: 1, fleet: 1, timestamp: "2020-01-02T20:00:00Z" },
      { funds: "1", fans: 1, fleet: 1, timestamp: "2020-01-05T20:00:00Z" },
      { funds: "1", fans: 1, fleet: 1, timestamp: "2020-01-06T20:00:00Z" },
      { funds: "1", fans: 1, fleet: 1, timestamp: "2020-01-12T20:00:00Z" },
    ]);
    expect(findGaps(snaps)).toEqual([
      { from: "2020-01-07", to: "2020-01-11", days: 5 },
      { from: "2020-01-03", to: "2020-01-04", days: 2 },
    ]);
  });

  it("matches the committed fixture", () => {
    const series = FundingSeries.parse(
      JSON.parse(readFileSync(join(fundingDir, "Funding.json"), "utf8")),
    );
    expect(findGaps(series.snapshots)).toEqual(series.source.gaps);
  });
});
