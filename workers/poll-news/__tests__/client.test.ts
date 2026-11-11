import { describe, expect, it } from "vitest";
import { userAgent } from "schema/site";
import { type FetchLike, createClient } from "../src/client.js";

function recorder(): {
  fetch: FetchLike;
  calls: { url: string; headers: Record<string, string> }[];
} {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return { ok: true, status: 200, text: async () => "ok" };
  };
  return { fetch, calls };
}

describe("the news client's User-Agent (ADR-036)", () => {
  it("sends the header docs/legal/obligations.md asks for, with the contact address", async () => {
    const { fetch, calls } = recorder();
    const client = createClient({
      fetch,
      contact: "ops@example.org",
      sleep: async () => undefined,
      now: () => 0,
    });
    await client.text("https://robertsspaceindustries.com/comm-link");
    expect(calls[0]?.headers["User-Agent"]).toBe(
      userAgent("poll-news", "ops@example.org"),
    );
    expect(calls[0]?.headers["User-Agent"]).toBe(
      "SC-Hub/1.0 (+https://coppercork.com/about; ops@example.org) poll-news",
    );
  });

  it("still names the about page to a host that needs no address", async () => {
    const { fetch, calls } = recorder();
    const client = createClient({
      fetch,
      contact: null,
      sleep: async () => undefined,
      now: () => 0,
    });
    await client.text("https://api.star-citizen.wiki/api/v2/comm-links");
    expect(calls[0]?.headers["User-Agent"]).toBe(
      "SC-Hub/1.0 (+https://coppercork.com/about) poll-news",
    );
  });
});
