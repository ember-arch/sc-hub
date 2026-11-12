import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/cron/refresh/route";

// ADR-056: the refresh clock's route. GitHub is faked; nothing here leaves the machine.

const SECRET = "cron-secret-for-tests";
const call = (authorization?: string) =>
  GET(
    new Request("https://site.example.test/api/cron/refresh", {
      headers: authorization ? { authorization } : {},
    }),
  );

const runs = (
  status: string,
  created_at: string,
  event = "workflow_dispatch",
  conclusion: string | null = "success",
) =>
  Response.json({
    workflow_runs: [
      { id: 7, event, status, conclusion, created_at, updated_at: created_at },
    ],
  });

describe("GET /api/cron/refresh", () => {
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

  it("starts the refresh on main when nothing ran today, and never logs the token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T06:23:00Z"));
    fetchMock
      .mockResolvedValueOnce(
        runs("completed", "2026-11-12T15:27:52Z", "schedule"),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dispatched: true });
    const [listUrl] = fetchMock.mock.calls[0]!;
    expect(listUrl).toBe(
      "https://api.github.com/repos/ember-arch/sc-hub/actions/workflows/refresh.yml/runs?per_page=10",
    );
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(
      "https://api.github.com/repos/ember-arch/sc-hub/actions/workflows/refresh.yml/dispatches",
    );
    expect(init?.method).toBe("POST");
    // No force_rebuild: the clock's run is the ordinary daily one.
    expect(JSON.parse(String(init?.body))).toEqual({ ref: "main" });
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer dispatch-token-for-tests");
    expect(headers["User-Agent"]).toMatch(/ refresh-clock$/);
    const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(logged).toContain('"job":"refresh-clock"');
    expect(logged).not.toContain("dispatch-token-for-tests");
    expect(logged).not.toContain(SECRET);
  });

  it("starts nothing while a run is under way, or when the clock already ran this morning", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T06:23:30Z"));
    fetchMock.mockResolvedValueOnce(
      runs("in_progress", "2026-11-12T15:00:00Z", "schedule", null),
    );
    expect(await (await call(`Bearer ${SECRET}`)).json()).toMatchObject({
      dispatched: false,
    });
    fetchMock.mockResolvedValueOnce(runs("completed", "2026-11-13T06:23:02Z"));
    expect(await (await call(`Bearer ${SECRET}`)).json()).toMatchObject({
      dispatched: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("answers 502 and starts nothing when the run list is not the shape it reads", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ workflow_runs: [{ id: "seven" }] }),
    );
    expect((await call(`Bearer ${SECRET}`)).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
