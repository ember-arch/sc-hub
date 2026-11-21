import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventRecord } from "schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REPO_ROOT } from "../lib/data";
import type * as Events from "../lib/events";

// ADR-057, amended 2026-11-15: the change-over clock starts the News workflow right after a show's
// day opens at RSI's change-over (16:00 UTC for IAE 2956: 8:00 in the Pacific), and the pages know
// when they go stale. On the frozen record, never the live one; GitHub is faked.

const frozen = EventRecord.parse(
  JSON.parse(
    readFileSync(
      join(REPO_ROOT, "fixtures", "events", "samples", "iae-2956.record.json"),
      "utf8",
    ),
  ),
);

vi.mock("../lib/events", async (importOriginal) => {
  const actual = await importOriginal<typeof Events>();
  return {
    ...actual,
    // The route asks with the shows on file; here, the frozen record unless a test names others.
    changeoverSkip: (now: Date, list: readonly EventRecord[] = [frozen]) =>
      actual.changeoverSkip(now, list),
  };
});

const { CHANGEOVER_WINDOW_MS, changeoverSkip, nextShowChange } =
  await import("../lib/events");
const { GET } = await import("../app/api/cron/changeover/route");
const { startNews } = await import("../lib/news-dispatch");
const { GET: newsGET } = await import("../app/api/cron/news/route");

const SECRET = "cron-secret-for-tests";
const call = (authorization?: string) =>
  GET(
    new Request("https://site.example.test/api/cron/changeover", {
      headers: authorization ? { authorization } : {},
    }),
  );
const idle = () =>
  Response.json({
    workflow_runs: [
      {
        id: 7,
        event: "workflow_dispatch",
        status: "completed",
        created_at: "2026-11-15T15:37:17Z",
        updated_at: "2026-11-15T15:38:30Z",
      },
    ],
  });

describe("when a page goes stale", () => {
  const next = (iso: string) => nextShowChange(new Date(iso), [frozen]);

  it("is RSI's next change-over while the show runs", () => {
    expect(next("2026-11-15T15:59:00Z")).toBe("2026-11-15T16:00:00.000Z");
    expect(next("2026-11-15T16:00:00Z")).toBe("2026-11-16T16:00:00.000Z");
  });

  it("is the eve, then the doors, before it opens, and the end on its last day", () => {
    expect(next("2026-11-01T12:00:00Z")).toBe("2026-11-12T00:00:00.000Z");
    expect(next("2026-11-13T09:00:00Z")).toBe("2026-11-13T16:00:00.000Z");
    expect(next("2026-11-27T20:00:00Z")).toBe("2026-11-28T00:00:00.000Z");
  });

  it("is never once every show is over", () => {
    expect(next("2026-11-28T00:00:00Z")).toBeNull();
    expect(nextShowChange(new Date("2026-11-15T12:00:00Z"), [])).toBeNull();
  });
});

describe("whether the change-over clock starts a run", () => {
  const skip = (iso: string) => changeoverSkip(new Date(iso), [frozen]);

  it("starts one inside the quarter hour after a day opens", () => {
    expect(skip("2026-11-13T16:01:00Z")).toBeNull();
    expect(skip("2026-11-15T16:01:00Z")).toBeNull();
    expect(
      changeoverSkip(
        new Date(Date.parse("2026-11-15T16:00:00Z") + CHANGEOVER_WINDOW_MS),
        [frozen],
      ),
    ).toBeNull();
  });

  it("starts none any other hour, before the show or with none on file", () => {
    expect(skip("2026-11-15T16:16:00Z")).toMatch(/no show's day opened/);
    expect(skip("2026-11-15T15:59:00Z")).toMatch(/no show's day opened/);
    expect(skip("2026-11-15T17:01:00Z")).toMatch(/no show's day opened/);
    expect(skip("2026-11-12T16:01:00Z")).toMatch(/no show's day opened/);
    // No show on file says so, so the log tells it from an ordinary hour.
    expect(changeoverSkip(new Date("2026-11-15T16:01:00Z"), [])).toBe(
      "no show on file",
    );
  });

  it("is on Vercel's cron a minute past each hour, beside the news clock", () => {
    const vercel = JSON.parse(
      readFileSync(join(REPO_ROOT, "apps", "web", "vercel.json"), "utf8"),
    ) as { crons: { path: string; schedule: string }[] };
    const at = (path: string) =>
      vercel.crons.find((c) => c.path === path)?.schedule;
    expect(at("/api/cron/changeover")).toBe("1 * * * *");
    expect(at("/api/cron/news")).toBe("7,37 * * * *");
  });
});

describe("GET /api/cron/changeover", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("NEWS_DISPATCH_TOKEN", "dispatch-token-for-tests");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };

  it("refuses a call without the secret, before it looks at the shows", async () => {
    at("2026-11-15T16:01:00Z");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts the News workflow on main right after RSI's change-over", async () => {
    at("2026-11-15T16:01:00Z");
    fetchMock
      .mockResolvedValueOnce(idle())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ dispatched: true });
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(
      "https://api.github.com/repos/ember-arch/sc-hub/actions/workflows/news.yml/dispatches",
    );
    // Never the hour's YouTube feed, though it is before half past: that is the :07 run's.
    expect(JSON.parse(String(init?.body))).toEqual({
      ref: "main",
      inputs: { video_slot: "" },
    });
    const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(logged).toContain('"job":"changeover-clock"');
    expect(logged).not.toContain("dispatch-token-for-tests");
    expect(logged).not.toContain(SECRET);
  });

  it("asks GitHub nothing in any other hour", async () => {
    at("2026-11-15T17:01:00Z");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      dispatched: false,
      reason: expect.stringMatching(/no show's day opened/),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 500 with a log line when the check before starting fails, and starts nothing", async () => {
    at("2026-11-15T16:01:00Z");
    const response = await startNews(
      new Request("https://site.example.test/api/cron/changeover", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
      {
        job: "changeover-clock",
        skip: () => {
          throw new Error("the show's record does not parse");
        },
      },
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      dispatched: false,
      reason: expect.stringContaining("does not parse"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(logged).toContain('"job":"changeover-clock"');
    expect(logged).toContain('"status":500');
  });

  it("leaves the news clock as it was: no show check, its own job name", async () => {
    at("2026-11-15T17:07:00Z");
    fetchMock
      .mockResolvedValueOnce(idle())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await newsGET(
      new Request("https://site.example.test/api/cron/news", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(await response.json()).toMatchObject({
      dispatched: true,
      video_slot: "due",
    });
    const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(logged).toContain('"job":"news-clock"');
  });
});
