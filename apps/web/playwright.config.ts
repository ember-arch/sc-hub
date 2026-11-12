import { defineConfig, devices } from "@playwright/test";

// One clock for the build and the tests (ADR-057): the pages are prerendered with the build's
// `now()`, and a test that reads the clock (is a show on?) must read the same one, or a run that
// crosses midnight UTC would disagree with its own build. The web server and the workers inherit
// this environment; a run that sets SITE_CLOCK itself keeps its own.
if ((process.env["SITE_CLOCK"] ?? "") === "") {
  const at = new Date();
  at.setSeconds(0, 0);
  process.env["SITE_CLOCK"] = at.toISOString();
}

/**
 * End-to-end tests and screenshots (CLAUDE.md section 6). Runs against a production build so
 * Lighthouse and the e2e suite see the same output; locally it reuses a dev server already on
 * port 3000 (`pnpm dev`) to keep the loop fast.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter:
    process.env.CI === undefined
      ? "list"
      : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 300_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
