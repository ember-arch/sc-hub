import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 00, criterion "Three key screens": home, one ship page and the news feed at 390 px and
// 1280 px, light and dark. Files land in e2e/__screenshots__/ and are attached to the PR.

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "__screenshots__");

const SCREENS = [
  { name: "home", path: "/" },
  { name: "ship", path: "/ships/gladius" },
  { name: "news", path: "/news" },
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
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        // No sideways scroll on phone (system.md principle 6).
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow, "page scrolls sideways").toBe(false);
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
