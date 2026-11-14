import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FundingCounter, type FundingSnapshot } from "schema";
import { describe, expect, it } from "vitest";
import {
  COUNTER_BODY,
  COUNTER_EVERY_MS,
  COUNTER_ORIGIN_URL,
  COUNTER_URL,
  RSI_SPACING_MS,
  RsiCrowdfundAnswer,
  counterDue,
  implausible,
  mapCounter,
  readCounter,
} from "../funding/counter-map.js";

// ADR-018, amended 2026-11-13: RSI's own counter, on the committed answer; no network.

const here = dirname(fileURLToPath(import.meta.url));
const fundingDir = join(here, "..", "..", "fixtures", "funding");
const sampleText = readFileSync(
  join(fundingDir, "samples", "crowdfund-stats.json"),
  "utf8",
);
const sample: unknown = JSON.parse(sampleText);
const answer = RsiCrowdfundAnswer.parse(sample);
const at = new Date("2026-11-14T01:28:33.491Z");
const read = (iso: string, previous: FundingCounter | null = null) =>
  FundingCounter.parse(mapCounter(answer, new Date(iso), previous));

describe("RSI's crowdfund answer", () => {
  it("parses the committed answer and maps it, cents to dollars", () => {
    const counter = read(at.toISOString());
    expect(counter.source).toEqual({
      name: "RSI",
      url: COUNTER_URL,
      origin_url: COUNTER_ORIGIN_URL,
    });
    expect(counter.read_at).toBe("2026-11-14T01:28:33.491Z");
    expect(counter.funds_usd).toBe(answer.data.funds / 100);
    expect(counter.funds_usd).toBeGreaterThan(1_000_000_000);
    expect(counter.citizens).toBe(answer.data.fans);
    expect(counter.previous_day).toBeNull();
  });

  it("halts on any other shape", () => {
    const bad: unknown[] = [
      { ...answer, success: 0 },
      { ...answer, code: "ErrNotFound" },
      { ...answer, extra: true },
      { ...answer, data: { ...answer.data, alpha: 1 } },
      { ...answer, data: { fans: answer.data.fans } },
      { ...answer, data: { ...answer.data, funds: "106477072304" } },
      { ...answer, data: { ...answer.data, funds: 1.5 } },
    ];
    for (const b of bad) {
      expect(RsiCrowdfundAnswer.safeParse(b).success).toBe(false);
    }
  });

  it("keeps the last reading of an earlier day, and carries it through the day", () => {
    const evening = read("2026-11-13T23:07:10.000Z");
    const late = read("2026-11-13T23:37:00.000Z", evening);
    // Same day: nothing earlier yet.
    expect(late.previous_day).toBeNull();
    const midnight = read("2026-11-14T00:07:00.000Z", late);
    expect(midnight.previous_day).toEqual({
      read_at: late.read_at,
      funds_usd: late.funds_usd,
      citizens: late.citizens,
    });
    // Later the same day, the earlier day's reading stays the 13th's last.
    const morning = read("2026-11-14T06:07:00.000Z", midnight);
    expect(morning.previous_day).toEqual(midnight.previous_day);
    // A day on, the 14th's last takes its place.
    const next = read("2026-11-15T00:07:00.000Z", morning);
    expect(next.previous_day?.read_at).toBe(morning.read_at);
  });

  it("refuses a time that is not UTC", () => {
    const counter = read(at.toISOString());
    expect(
      FundingCounter.safeParse({
        ...counter,
        read_at: "2026-11-14T01:28:33.491+01:00",
      }).success,
    ).toBe(false);
  });
});

describe("implausible", () => {
  const counter = read(at.toISOString());
  const snapshot = (
    funds: number,
    citizens: number | null,
  ): FundingSnapshot => ({
    day: "2026-11-12",
    recorded_at: "2026-11-12T20:00:13.000000Z",
    funds_usd: funds,
    citizens,
  });

  it("lets a normal reading and RSI's small corrections stand", () => {
    expect(implausible(counter, null)).toBeNull();
    expect(
      implausible(counter, snapshot(1_061_970_572.54, 6_756_903)),
    ).toBeNull();
    // A few percent below the last snapshot, as RSI's November 2019 corrections were.
    expect(
      implausible(
        counter,
        snapshot(counter.funds_usd * 1.04, counter.citizens * 1.04),
      ),
    ).toBeNull();
    expect(implausible(counter, snapshot(counter.funds_usd, null))).toBeNull();
  });

  it("stops a reading below half the last snapshot's, for either figure", () => {
    expect(
      implausible(counter, snapshot(counter.funds_usd * 2.1, 6_756_903)),
    ).toMatch(/^funds /);
    expect(
      implausible(counter, snapshot(1_061_970_572.54, counter.citizens * 2.1)),
    ).toMatch(/^citizens /);
  });
});

describe("counterDue", () => {
  it("is due with no reading, and once the reading is 55 minutes old", () => {
    expect(counterDue(null, at)).toBe(true);
    const last = read("2026-11-14T01:08:00.000Z");
    expect(counterDue(last, new Date("2026-11-14T01:38:00.000Z"))).toBe(false);
    expect(
      counterDue(
        last,
        new Date(Date.parse(last.read_at) + COUNTER_EVERY_MS - 1),
      ),
    ).toBe(false);
    expect(
      counterDue(last, new Date(Date.parse(last.read_at) + COUNTER_EVERY_MS)),
    ).toBe(true);
    // A run that started five minutes late, then the next hour's on time: still read hourly.
    const late = read("2026-11-14T01:12:00.000Z");
    expect(counterDue(late, new Date("2026-11-14T02:07:00.000Z"))).toBe(true);
  });
});

describe("readCounter", () => {
  interface Call {
    readonly url: string;
    readonly init: RequestInit | undefined;
  }
  const deps = (respond: () => Response) => {
    const calls: Call[] = [];
    const slept: number[] = [];
    return {
      calls,
      slept,
      deps: {
        fetch: (async (url: string | URL | Request, init?: RequestInit) => {
          calls.push({ url: String(url), init });
          return respond();
        }) as typeof fetch,
        sleep: async (ms: number) => {
          slept.push(ms);
        },
        now: () => at,
        userAgent: "Coppercork/test (ventures@example.invalid)",
      },
    };
  };
  const latest: FundingSnapshot = {
    day: "2026-11-12",
    recorded_at: "2026-11-12T20:00:13.000000Z",
    funds_usd: 1_061_970_572.54,
    citizens: 6_756_903,
  };

  it("waits the spacing, posts RSI's body with the project User-Agent, and maps the answer", async () => {
    const t = deps(() => new Response(sampleText, { status: 200 }));
    const { counter, answer: served } = await readCounter(null, latest, t.deps);
    expect(t.slept).toEqual([RSI_SPACING_MS]);
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]?.url).toBe(COUNTER_URL);
    expect(t.calls[0]?.init?.method).toBe("POST");
    expect(t.calls[0]?.init?.redirect).toBe("manual");
    expect(t.calls[0]?.init?.body).toBe(JSON.stringify(COUNTER_BODY));
    expect(
      (t.calls[0]?.init?.headers as Record<string, string>)["User-Agent"],
    ).toBe(t.deps.userAgent);
    expect(counter).toEqual(read(at.toISOString()));
    expect(served).toEqual(sample);
  });

  it("throws on a redirect, without following it", async () => {
    const t = deps(
      () =>
        new Response(null, {
          status: 301,
          headers: { location: "https://robertsspaceindustries.com/en/x" },
        }),
    );
    await expect(readCounter(null, latest, t.deps)).rejects.toThrow(
      "RSI answered 301",
    );
    expect(t.calls).toHaveLength(1);
  });

  it("throws on an error status, a page that is not JSON, an unknown shape and an implausible reading", async () => {
    await expect(
      readCounter(
        null,
        latest,
        deps(() => new Response("", { status: 503 })).deps,
      ),
    ).rejects.toThrow("RSI answered 503");
    await expect(
      readCounter(
        null,
        latest,
        deps(() => new Response("<html>challenge</html>", { status: 200 }))
          .deps,
      ),
    ).rejects.toThrow("not JSON");
    await expect(
      readCounter(
        null,
        latest,
        deps(
          () =>
            new Response(JSON.stringify({ ...answer, success: 0 }), {
              status: 200,
            }),
        ).deps,
      ),
    ).rejects.toThrow();
    await expect(
      readCounter(
        null,
        { ...latest, funds_usd: answer.data.funds },
        deps(() => new Response(sampleText, { status: 200 })).deps,
      ),
    ).rejects.toThrow("implausible reading: funds");
  });
});
