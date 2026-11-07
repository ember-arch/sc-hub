import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 00, criterion "Three key screens": home, one ship page and the news feed at 390 px and
// 1280 px, light and dark; CLAUDE.md section 8: screenshots for every page a PR touched. Files
// land in e2e/__screenshots__/ and are attached to the PR.

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "__screenshots__");

/** The three key screens first; the other Phase 0 routes follow. Slugs come from the bootstrap pack. */
const SCREENS = [
  { name: "home", path: "/", status: 200 },
  { name: "ship", path: "/ships/gladius", status: 200 },
  { name: "news", path: "/news", status: 200 },
  { name: "ships", path: "/ships", status: 200 },
  { name: "components", path: "/components", status: 200 },
  {
    name: "component",
    path: "/components/aegis-gladius-noise-launcher",
    status: 200,
  },
  { name: "manufacturer", path: "/manufacturers/aegis-dynamics", status: 200 },
  { name: "news-dev", path: "/news/dev", status: 200 },
  { name: "about", path: "/about", status: 200 },
  { name: "privacy", path: "/privacy", status: 200 },
  { name: "licenses", path: "/licenses", status: 200 },
  { name: "not-found", path: "/ships/no-such-ship", status: 404 },
] as const;
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const;
const SCHEMES = ["light", "dark"] as const;

for (const screen of SCREENS) {
  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`${screen.name} at ${viewport.width} px, ${scheme}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const response = await page.goto(screen.path);
        expect(response?.status()).toBe(screen.status);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        // No sideways scroll on phone (system.md principle 6).
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow, "page scrolls sideways").toBe(false);
        // Port and item names must wrap at their parts, never into fragments shorter than a word.
        if (viewport.name === "phone" && screen.name === "ship") {
          const tooNarrow = await page.evaluate(() => {
            const cells = [...document.querySelectorAll("td span.font-mono")];
            return cells.filter((cell) => {
              const rects = [...cell.getClientRects()];
              return rects.length > 1 && rects.some((r) => r.width < 40);
            }).length;
          });
          expect(tooNarrow, "port names wrapped into fragments").toBe(0);
        }
        mkdirSync(OUT, { recursive: true });
        await page.screenshot({
          path: join(OUT, `${screen.name}-${viewport.name}-${scheme}.png`),
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}
