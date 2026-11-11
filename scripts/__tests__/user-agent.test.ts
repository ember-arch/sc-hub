import { afterEach, describe, expect, it, vi } from "vitest";
import { rsiUserAgent, userAgent } from "../user-agent.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the dev scripts' User-Agent (ADR-036)", () => {
  it("is the one docs/legal/obligations.md asks for, with the address from SC_HUB_CONTACT_EMAIL", () => {
    vi.stubEnv("SC_HUB_CONTACT_EMAIL", " ops@example.org ");
    expect(userAgent("bootstrap")).toBe(
      "SC-Hub/1.0 (+https://coppercork.com/about; ops@example.org) bootstrap",
    );
    expect(rsiUserAgent("media")).toBe(
      "SC-Hub/1.0 (+https://coppercork.com/about; ops@example.org) media",
    );
  });

  it("leaves the address out when the variable is unset or blank", () => {
    vi.stubEnv("SC_HUB_CONTACT_EMAIL", "");
    expect(userAgent("titles")).toBe(
      "SC-Hub/1.0 (+https://coppercork.com/about) titles",
    );
  });

  it("refuses to address RSI without the contact address", () => {
    vi.stubEnv("SC_HUB_CONTACT_EMAIL", "");
    expect(() => rsiUserAgent("media")).toThrow(/SC_HUB_CONTACT_EMAIL/);
  });
});
