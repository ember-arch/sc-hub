import { defineConfig, devices } from "@playwright/test";

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
