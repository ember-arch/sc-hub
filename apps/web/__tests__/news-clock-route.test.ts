import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/cron/news/route";

// ADR-053: the news clock's route. GitHub is faked; nothing here leaves the machine.

const SECRET = "cron-secret-for-tests";
const call = (authorization?: string) =>
  GET(
    new Request("https://site.example.test/api/cron/news", {
      headers: authorization ? { authorization } : {},
    }),
  );

const runs = (status: string, updated_at: string) =>
  Response.json({
    workflow_runs: [
      {
        id: 7,
        event: "schedule",
        status,
        created_at: updated_at,
        updated_at,
      },
    ],
  });

describe("GET /api/cron/news", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("NEWS_DISPATCH_TOKEN", "dispatch-token-for-tests");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("refuses every call while CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a call without the secret, or with a wrong one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing without the dispatch token, and says so", async () => {
    vi.stubEnv("NEWS_DISPATCH_TOKEN", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ dispatched: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-11-12T07:07:00Z", "due"],
    ["2026-11-12T07:37:00Z", ""],
  ])(
    "starts the workflow on main when no run is under way (at %s the video slot is %j), and never logs the token",
    async (at, slot) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(at));
      fetchMock
        .mockResolvedValueOnce(runs("completed", "2026-01-01T00:00:00Z"))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      const response = await call(`Bearer ${SECRET}`);
      vi.useRealTimers();
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        dispatched: true,
        video_slot: slot,
      });
      const [url, init] = fetchMock.mock.calls[1]!;
      expect(url).toBe(
        "https://api.github.com/repos/ember-arch/sc-hub/actions/workflows/news.yml/dispatches",
      );
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        ref: "main",
        inputs: { video_slot: slot },
      });
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer dispatch-token-for-tests");
      expect(headers["User-Agent"]).toMatch(/ news-clock$/);
      const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
      expect(logged).toContain('"run_id"');
      expect(logged).not.toContain("dispatch-token-for-tests");
      expect(logged).not.toContain(SECRET);
    },
  );

  it("still matches a secret stored with a stray space, which the header loses in transit", async () => {
    vi.stubEnv("CRON_SECRET", ` ${SECRET} `);
    vi.stubEnv("NEWS_DISPATCH_TOKEN", "");
    expect((await call(`Bearer  ${SECRET} `)).status).toBe(401);
    expect((await call(`Bearer ${SECRET} `)).status).toBe(200);
    expect((await call(`Bearer ${SECRET}x`)).status).toBe(401);
  });

  it("starts nothing while a run is under way", async () => {
    fetchMock.mockResolvedValueOnce(
      runs("in_progress", "2026-01-01T00:00:00Z"),
    );
    const response = await call(`Bearer ${SECRET}`);
    expect(await response.json()).toMatchObject({ dispatched: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 502 when GitHub refuses, so the failure shows in Vercel's logs", async () => {
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 401 }));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(502);
    fetchMock
      .mockResolvedValueOnce(runs("completed", "2026-01-01T00:00:00Z"))
      .mockResolvedValueOnce(new Response("no", { status: 422 }));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(502);
  });
});
