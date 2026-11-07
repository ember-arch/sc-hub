import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchError, createWikiClient } from "../bootstrap-fixtures/fetch.js";

// The client is tested on fake timers with a scripted fetch: no network, ever.

type Scripted = { status: number; body?: unknown } | Error;

function scripted(responses: Scripted[]) {
  const calls: { url: string; at: number; userAgent: string }[] = [];
  const fetch = vi.fn(
    async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({
        url,
        at: Date.now(),
        userAgent: init.headers["User-Agent"] ?? "",
      });
      const next = responses.shift();
      if (next === undefined) throw new Error("no scripted response left");
      if (next instanceof Error) throw next;
      return {
        ok: next.status >= 200 && next.status < 300,
        status: next.status,
        json: async () => {
          if (next.body === undefined) throw new SyntaxError("not json");
          return next.body;
        },
      };
    },
  );
  return { fetch, calls };
}

describe("createWikiClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spaces requests at least 2.5 seconds apart and identifies itself", async () => {
    const { fetch, calls } = scripted([
      { status: 200, body: { a: 1 } },
      { status: 200, body: { b: 2 } },
      { status: 200, body: { c: 3 } },
    ]);
    const client = createWikiClient({ fetch, userAgent: "test-agent/0" });
    const all = Promise.all([
      client.getJson("/a"),
      client.getJson("/b"),
      client.getJson("/c"),
    ]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await all).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    expect(calls.map((c) => c.at)).toEqual([0, 2500, 5000]);
    expect(calls[0]?.url).toBe("https://api.star-citizen.wiki/a");
    expect(calls[0]?.userAgent).toBe("test-agent/0");
    expect(client.requests).toBe(3);
  });

  it("backs off on 429 and 5xx inside the same queue", async () => {
    const { fetch, calls } = scripted([
      { status: 429 },
      { status: 500 },
      { status: 200, body: { ok: true } },
    ]);
    const events: Record<string, unknown>[] = [];
    const client = createWikiClient({
      fetch,
      userAgent: "t",
      log: (event) => events.push(event),
    });
    const result = client.getJson("/x");
    await vi.advanceTimersByTimeAsync(100_000);
    expect(await result).toEqual({ ok: true });
    expect(calls.map((c) => c.at)).toEqual([0, 5000, 25_000]);
    expect(client.requests).toBe(3);
    expect(events.map((e) => e["event"])).toEqual([
      "bootstrap.fetch.retry",
      "bootstrap.fetch.retry",
    ]);
  });

  it("retries a network error the same way", async () => {
    const { fetch, calls } = scripted([
      new Error("socket hang up"),
      { status: 200, body: 1 },
    ]);
    const client = createWikiClient({ fetch, userAgent: "t" });
    const result = client.getJson("/x");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe(1);
    expect(calls.map((c) => c.at)).toEqual([0, 5000]);
  });

  it("gives up after three retries with a FetchError", async () => {
    const { fetch } = scripted([
      { status: 503 },
      { status: 503 },
      { status: 503 },
      { status: 503 },
    ]);
    const client = createWikiClient({ fetch, userAgent: "t" });
    const result = client.getJson("/x");
    const assertion = expect(result).rejects.toMatchObject({
      name: "FetchError",
      status: 503,
    });
    await vi.advanceTimersByTimeAsync(200_000);
    await assertion;
    expect(client.requests).toBe(4);
  });

  it("does not retry a 404", async () => {
    const { fetch } = scripted([{ status: 404 }]);
    const client = createWikiClient({ fetch, userAgent: "t" });
    const result = client.getJson("/missing");
    const assertion = expect(result).rejects.toBeInstanceOf(FetchError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(client.requests).toBe(1);
  });

  it("rejects a response that is not JSON and keeps the queue alive", async () => {
    const { fetch, calls } = scripted([
      { status: 200 },
      { status: 200, body: { next: true } },
    ]);
    const client = createWikiClient({ fetch, userAgent: "t" });
    const first = client.getJson("/bad");
    const second = client.getJson("/good");
    const assertion = expect(first).rejects.toBeInstanceOf(FetchError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(await second).toEqual({ next: true });
    expect(calls.map((c) => c.at)).toEqual([0, 2500]);
  });
});
