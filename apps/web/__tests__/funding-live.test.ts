import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatChange,
  formatCompact,
  formatReadAt,
  formatShare,
  formatShortDay,
  formatValue,
  headline,
  liveContext,
  readings,
  sameMomentChange,
  withCounter,
  yearAgainstLastYear,
  yearOnYear,
} from "../lib/funding";
import { loadCounter, loadFunding } from "../lib/funding";
import {
  type LiveContext,
  liveFigures,
  yearOnYearAt,
} from "../lib/funding-live";
import {
  type ReadFloor,
  readLive,
  readLiveAtMost,
} from "../lib/funding-live-read";
import { REPO_ROOT } from "../lib/data";

// ADR-018, amended 2026-11-13: the front page's figures recomputed in the browser from RSI's counter,
// on the committed fixtures; and the site's one read of RSI's counter, with no network.

const wiki = loadFunding();
const counter = loadCounter();
if (wiki === null || counter === null)
  throw new Error("funding fixtures missing");
const { series } = withCounter(wiki, counter);
const ctx = liveContext(wiki, series) as LiveContext;
const pledges = readings(series, "pledges");
const money = headline(pledges)!;
const later = (minutes: number): string =>
  new Date(Date.parse(counter.read_at) + minutes * 60_000).toISOString();

describe("liveFigures", () => {
  it("prints, at the page's own reading, what the server printed", () => {
    // A millisecond later, so it counts as newer: the same figures to the cent.
    const at = later(0.00002);
    const f = liveFigures(ctx, {
      read_at: at,
      funds_usd: counter.funds_usd,
      citizens: counter.citizens,
    })!;
    expect(f.pledged).toBe(formatValue(money.latest.value, "pledges"));
    expect(f.thisYear).toBe(formatCompact(money.yearToDate!, "pledges"));
    const yoy = yearOnYear(wiki, "pledges", counter);
    expect(f.thisYearNote).toMatch(
      new RegExp(
        `^${formatChange(yoy.change!).replace("+", "\\+")} on the same days of \\d{4}`,
      ),
    );
    const against = yearAgainstLastYear(pledges)!;
    expect(f["pledges.ytd"]).toBe(formatValue(against.yearToDate!, "pledges"));
    expect(f["pledges.yoy"]).toBe(formatChange(yoy.change!));
    const people = headline(readings(series, "citizens"))!;
    expect(f.citizens).toBe(formatValue(people.latest.value, "citizens"));
    expect(f.citizensNote).toMatch(/in the last 30 days$/);
    expect(f.pledgedNote).toBe(`as of ${formatReadAt(at, true)}`);
    expect(f.head).toBe(`as of ${formatReadAt(at)}`);
    expect(f.readAtSentence).toContain(
      "while the page is open it follows the counter minute by minute",
    );
  });

  it("moves every figure with a later reading", () => {
    const at = later(60);
    const f = liveFigures(ctx, {
      read_at: at,
      funds_usd: counter.funds_usd + 250_000,
      citizens: counter.citizens + 120,
    })!;
    expect(f.pledged).toBe(formatValue(counter.funds_usd + 250_000, "pledges"));
    expect(f["pledges.ytd"]).toBe(
      formatValue(money.yearToDate! + 250_000, "pledges"),
    );
    expect(f.citizens).toBe(formatValue(counter.citizens + 120, "citizens"));
  });

  it("leaves the page as it is for an older reading, another year's, or an implausible one", () => {
    const base = { funds_usd: counter.funds_usd, citizens: counter.citizens };
    expect(liveFigures(ctx, { ...base, read_at: counter.read_at })).toBeNull();
    expect(
      liveFigures(ctx, {
        ...base,
        read_at: `${ctx.year + 1}-01-01T00:05:00.000Z`,
      }),
    ).toBeNull();
    expect(
      liveFigures(ctx, { ...base, read_at: later(5), funds_usd: 1 }),
    ).toBeNull();
    expect(
      liveFigures(ctx, { ...base, read_at: later(5), citizens: 1 }),
    ).toBeNull();
  });
});

describe("the browser's comparison", () => {
  it("is the server's at the same reading, from the context's window of last year", () => {
    const at = later(30);
    const reading = {
      read_at: at,
      funds_usd: counter.funds_usd + 1,
      citizens: counter.citizens,
    };
    expect(yearOnYearAt(ctx.pledges, reading.funds_usd, at).change).toBe(
      sameMomentChange(wiki, "pledges", reading),
    );
  });

  it("falls back to the wiki's comparison, with its day, once the window is passed", () => {
    // Twenty days on, last year's readings in the context no longer reach the point.
    const at = later(20 * 24 * 60);
    const y = yearOnYearAt(ctx.pledges, counter.funds_usd + 1, at);
    expect(y.change).toBe(ctx.pledges.fallback?.change ?? null);
    expect(y.to).toBe(ctx.pledges.fallback?.to ?? null);
  });

  it("shows through last year's IAE: a single big day of last year is within five points", () => {
    // 21 November 2026, during last year's IAE days (20 November to 3 December 2025).
    const at = "2026-11-21T01:00:00.000Z";
    const reading = {
      read_at: at,
      funds_usd: counter.funds_usd + 6_000_000,
      citizens: counter.citizens,
    };
    expect(sameMomentChange(wiki, "pledges", reading)).not.toBeNull();
  });
});

describe("readLive", () => {
  const sample = readFileSync(
    join(REPO_ROOT, "fixtures", "funding", "samples", "crowdfund-stats.json"),
    "utf8",
  );
  const now = () => new Date("2026-11-14T03:00:00.000Z");
  const recorder = (respond: () => Response) => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(url), init });
      return respond();
    }) as typeof fetch;
    return { calls, fetchImpl };
  };

  it("asks nothing without a contact address", async () => {
    const r = recorder(() => new Response(sample));
    expect(await readLive(r.fetchImpl, undefined, now)).toEqual({
      ok: false,
      reason: "no contact address",
    });
    expect(await readLive(r.fetchImpl, "  ", now)).toMatchObject({ ok: false });
    expect(r.calls).toHaveLength(0);
  });

  it("posts RSI's body with the project User-Agent and maps the answer, cents to dollars", async () => {
    const r = recorder(() => new Response(sample, { status: 200 }));
    const out = await readLive(r.fetchImpl, "ventures@example.invalid", now);
    const answer = JSON.parse(sample) as {
      data: { funds: number; fans: number };
    };
    expect(out).toEqual({
      ok: true,
      read_at: "2026-11-14T03:00:00.000Z",
      funds_usd: answer.data.funds / 100,
      citizens: answer.data.fans,
    });
    expect(r.calls[0]?.init?.method).toBe("POST");
    expect(r.calls[0]?.init?.redirect).toBe("manual");
    expect(
      (r.calls[0]?.init?.headers as Record<string, string>)["User-Agent"],
    ).toContain("ventures@example.invalid");
  });

  it("gives ok false on a redirect, an error, a page that is not JSON and an unknown shape", async () => {
    const cases = [
      () => new Response(null, { status: 301, headers: { location: "/x" } }),
      () => new Response("", { status: 503 }),
      () => new Response("<html>challenge</html>", { status: 200 }),
      () =>
        new Response(JSON.stringify({ success: 1, code: "OK" }), {
          status: 200,
        }),
    ];
    for (const respond of cases) {
      const r = recorder(respond);
      expect(
        await readLive(r.fetchImpl, "ventures@example.invalid", now),
      ).toMatchObject({
        ok: false,
      });
      expect(r.calls).toHaveLength(1);
    }
  });
});

describe("readLiveAtMost", () => {
  const sample = readFileSync(
    join(REPO_ROOT, "fixtures", "funding", "samples", "crowdfund-stats.json"),
    "utf8",
  );
  it("asks RSI at most once a minute per instance, failures included, and shares a read in flight", async () => {
    let calls = 0;
    let status = 200;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(status === 200 ? sample : "", { status });
    }) as typeof fetch;
    const floor: ReadFloor = { last: null, pending: null };
    let t = Date.parse("2026-11-14T03:00:00.000Z");
    const now = () => new Date(t);
    const [a, b] = await Promise.all([
      readLiveAtMost(fetchImpl, "ventures@example.invalid", now, floor),
      readLiveAtMost(fetchImpl, "ventures@example.invalid", now, floor),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    t += 59_000;
    expect(
      await readLiveAtMost(fetchImpl, "ventures@example.invalid", now, floor),
    ).toEqual(a);
    expect(calls).toBe(1);
    // A minute on, RSI is asked again; a failure is kept for the minute too.
    t += 1_000;
    status = 503;
    const failed = await readLiveAtMost(
      fetchImpl,
      "ventures@example.invalid",
      now,
      floor,
    );
    expect(failed).toMatchObject({ ok: false });
    expect(calls).toBe(2);
    t += 30_000;
    expect(
      await readLiveAtMost(fetchImpl, "ventures@example.invalid", now, floor),
    ).toEqual(failed);
    expect(calls).toBe(2);
  });

  it("counts a thrown error as a failed read", async () => {
    const floor: ReadFloor = { last: null, pending: null };
    const fetchImpl = (async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as typeof fetch;
    expect(
      await readLiveAtMost(
        fetchImpl,
        "ventures@example.invalid",
        () => new Date(),
        floor,
      ),
    ).toEqual({ ok: false, reason: "TimeoutError" });
  });
});

describe("liveFigures, every slot at the page's own reading", () => {
  it("matches the card's figures for both measures", () => {
    const at = new Date(Date.parse(counter.read_at) + 1).toISOString();
    const f = liveFigures(ctx, {
      read_at: at,
      funds_usd: counter.funds_usd,
      citizens: counter.citizens,
    })!;
    for (const measure of ["pledges", "citizens"] as const) {
      const list = readings(series, measure);
      const against = yearAgainstLastYear(list)!;
      const yoy = yearOnYear(wiki, measure, counter);
      expect(f[`${measure}.ytd`]).toBe(
        formatValue(against.yearToDate!, measure),
      );
      expect(f[`${measure}.ytdShort`]).toBe(
        formatCompact(against.yearToDate!, measure),
      );
      expect(f[`${measure}.ytdNote`]).toBe(
        `to ${formatShortDay(list.at(-1)!.day)}`,
      );
      expect(f[`${measure}.share`]).toBe(
        against.shareOfLastYear === null
          ? "unknown"
          : formatShare(against.shareOfLastYear),
      );
      expect(f[`${measure}.yoy`]).toBe(
        yoy.change === null ? "unknown" : formatChange(yoy.change),
      );
      expect(f[`${measure}.yoyNote`]).toBe(
        yoy.to === null || yoy.to === list.at(-1)!.day
          ? `on the same days of ${against.year - 1}`
          : `to ${formatShortDay(yoy.to)}, on the same days of ${against.year - 1}`,
      );
    }
  });
});
