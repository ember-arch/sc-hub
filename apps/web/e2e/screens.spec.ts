import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 00, criterion "Three key screens", and CLAUDE.md section 8: screenshots for every page a
// PR touched at 390 px and 1280 px, light and dark. Files land in e2e/__screenshots__/ and are
// attached to the PR. Ship slugs are read from the pack: the first small ship and the first
// capital ship, so a re-slug changes the data, not this file.

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "__screenshots__");

interface VehicleRow {
  slug: string;
  size_class: string | null;
}
const vehicles = JSON.parse(
  readFileSync(join(here, "../../../fixtures/bootstrap/Vehicle.json"), "utf8"),
) as VehicleRow[];
const slugOf = (size: string): string => {
  const found = vehicles.find((v) => v.size_class === size)?.slug;
  if (found === undefined) throw new Error(`pack has no ${size} ship`);
  return found;
};
const smallShip = slugOf("small");
const capitalShip = slugOf("capital");
const compared = vehicles
  .slice(0, 4)
  .map((v) => v.slug)
  .join(",");

/** The three key screens first; the other routes follow. */
const SCREENS = [
  { name: "home", path: "/", status: 200 },
  { name: "ship", path: `/ships/${smallShip}`, status: 200 },
  { name: "ship-capital", path: `/ships/${capitalShip}`, status: 200 },
  // The concept hero (ADR-010): a ship file with no game data.
  { name: "ship-concept", path: "/ships/odin", status: 200 },
  { name: "news", path: "/news", status: 200 },
  { name: "news-videos", path: "/news/videos", status: 200 },
  { name: "ships", path: "/ships", status: 200 },
  { name: "ships-table", path: "/ships?view=table", status: 200 },
  { name: "ships-filtered", path: "/ships?size=small", status: 200 },
  {
    name: "compare",
    path: `/compare?ships=${compared}`,
    status: 200,
  },
  { name: "compare-empty", path: "/compare", status: 200 },
  { name: "components", path: "/components", status: 200 },
  {
    name: "components-filtered",
    path: "/components?manufacturer=behring-applied-technology",
    status: 200,
  },
  {
    name: "component",
    path: "/components/aegis-gladius-noise-launcher",
    status: 200,
  },
  { name: "manufacturer", path: "/manufacturers/aegis-dynamics", status: 200 },
  { name: "news-dev", path: "/news/dev", status: 200 },
  { name: "titles", path: "/titles", status: 200 },
  // The patch pages (spec 08, ADR-049).
  { name: "patches", path: "/patches", status: 200 },
  { name: "patches-ptu", path: "/patches/ptu", status: 200 },
  { name: "patches-compare", path: "/patches/compare", status: 200 },
  { name: "titles-guide", path: "/titles?group=guide", status: 200 },
  // The shows (ADR-057): the event page in the canonical format, and the index.
  { name: "event", path: "/events/iae-2956", status: 200 },
  { name: "events", path: "/events", status: 200 },
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
        // The front page's live funding route has nothing newer, so the records show the build's
        // figures wherever they are drawn (ADR-018, amended 2026-11-13).
        await context.route("**/api/funding/live", (route) =>
          route.fulfill({ json: { ok: false, reason: "screenshots" } }),
        );
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
        // Port names in the opened port table must wrap at their parts (the break after each
        // underscore), never into fragments shorter than a word.
        if (viewport.name === "phone" && screen.name.startsWith("ship")) {
          const summary = page.locator("#hardpoints details summary", {
            hasText: /ports by game name$/,
          });
          const hasTable = (await summary.count()) > 0;
          if (hasTable) await summary.click();
          const tooNarrow = await page.evaluate(() => {
            const cells = [
              ...document.querySelectorAll("#hardpoints td span.font-mono"),
            ];
            return cells.filter((cell) => {
              const rects = [...cell.getClientRects()];
              return rects.length > 1 && rects.some((r) => r.width < 40);
            }).length;
          });
          expect(tooNarrow, "names wrapped into fragments").toBe(0);
          if (hasTable) await summary.click();
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
