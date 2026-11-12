import { describe, expect, it } from "vitest";
import { rsiGet } from "../rsi-fetch.js";

// CLAUDE.md section 9: one request to RSI every 5 seconds, redirects included. RSI moved its pledge
// pages under /en/ and answers the old addresses with a 301. No network: the fetch is a fake.

function fakeRsi(
  routes: Record<string, { status: number; location?: string }>,
) {
  const calls: { url: string; at: number; redirect: unknown }[] = [];
  let clock = 0;
  const fetchImpl = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    calls.push({ url, at: clock, redirect: init?.redirect });
    const route = routes[url] ?? { status: 404 };
    return new Response(
      route.status >= 300 && route.status < 400 ? null : "page",
      {
        status: route.status,
        headers:
          route.location === undefined ? {} : { location: route.location },
      },
    );
  }) as typeof fetch;
  const sleep = async (ms: number) => {
    clock += ms;
  };
  return { calls, fetchImpl, sleep };
}

const OLD = "https://robertsspaceindustries.com/pledge/ships/arrastra/Arrastra";
const NEW =
  "https://robertsspaceindustries.com/en/pledge/ships/arrastra/Arrastra";
const options = (f: ReturnType<typeof fakeRsi>) => ({
  spacingMs: 5000,
  sleep: f.sleep,
  fetch: f.fetchImpl,
});

describe("rsiGet", () => {
  it("follows RSI's redirect to /en/ only after the spacing", async () => {
    const f = fakeRsi({
      [OLD]: { status: 301, location: "/en/pledge/ships/arrastra/Arrastra" },
      [NEW]: { status: 200 },
    });
    const response = await rsiGet(
      OLD,
      { headers: { "User-Agent": "test" } },
      options(f),
    );
    expect(response.status).toBe(200);
    expect(f.calls.map((c) => c.url)).toEqual([OLD, NEW]);
    expect(f.calls[1]!.at - f.calls[0]!.at).toBeGreaterThanOrEqual(5000);
    expect(f.calls.every((c) => c.redirect === "manual")).toBe(true);
  });

  it("makes one request when there is no redirect", async () => {
    const f = fakeRsi({ [NEW]: { status: 200 } });
    await rsiGet(NEW, { headers: {} }, options(f));
    expect(f.calls).toHaveLength(1);
  });

  it("hands back an error answer as it is, for the caller to halt on", async () => {
    const f = fakeRsi({});
    expect((await rsiGet(NEW, { headers: {} }, options(f))).status).toBe(404);
  });

  it("gives up on a redirect loop", async () => {
    const f = fakeRsi({ [OLD]: { status: 301, location: OLD } });
    await expect(rsiGet(OLD, { headers: {} }, options(f))).rejects.toThrow(
      /more than 3 redirects/,
    );
  });
});
