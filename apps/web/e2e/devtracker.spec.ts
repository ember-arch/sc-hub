import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { DISCLAIMER } from "../../../packages/ui/legal";

// The dev tracker with the pack's Spectrum posts shown (spec 03, "Dev tracker UI" and "Author
// pages"): runs only when the server was built with SPECTRUM_MODE on, which the live site is not
// until docs/legal/cig-approval.md ticks the Spectrum box; CI and the plain suite skip it. Run it
// locally with `SPECTRUM_MODE=poll pnpm test:e2e`, or a local config whose webServer sets it.
// Screenshots of the tracker and the busiest author's page land in e2e/__screenshots__/ at 390 px
// and 1280 px, light and dark, like every page a PR touches (CLAUDE.md section 8).

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "__screenshots__");
const on = ["poll", "feed"].includes(process.env["SPECTRUM_MODE"] ?? "");

interface AuthorRow {
  handle: string;
  display_name: string;
  post_count: number;
}
const authors: AuthorRow[] = on
  ? (JSON.parse(
      readFileSync(join(here, "../../../fixtures/news/Author.json"), "utf8"),
    ) as AuthorRow[])
  : [];
const busiest = [...authors].sort((a, b) => b.post_count - a.post_count)[0];

test.describe("the dev tracker with Spectrum on", () => {
  test.skip(!on, "SPECTRUM_MODE is off: the tracker is its empty state");

  test("shows the pack's developer posts as folded cards with the tabs drawn", async ({
    page,
  }) => {
    await page.goto("/news/dev");
    await expect(page.getByText("Tracker not yet connected")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "News sections" }),
    ).toBeVisible();
    const posts = page.locator("article");
    expect(await posts.count()).toBeGreaterThan(0);
    const links = page.getByRole("link", { name: "View on Spectrum" });
    for (const href of await links.evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")),
    )) {
      expect(href).toMatch(
        /^https:\/\/robertsspaceindustries\.com\/spectrum\//,
      );
    }
  });

  test("a folded post keeps its Spectrum link visible and opens to the whole post on a tap", async ({
    page,
  }) => {
    await page.goto("/news/dev");
    const card = page.locator("article").first();
    await expect(
      card.getByRole("link", { name: "View on Spectrum" }),
    ).toBeVisible();
    const body = card.locator(".dev-post-body");
    await expect(body).toBeHidden();
    await card.locator("summary").click();
    await expect(body).toBeVisible();
    await expect(card.getByText("Fold the post")).toBeVisible();
    await expect(
      card.getByRole("link", { name: "View on Spectrum" }),
    ).toBeVisible();
  });

  test("an author page pages by twenty, carries the disclaimer, and a wide post never scrolls sideways", async ({
    browser,
  }) => {
    test.skip(busiest === undefined, "no author on record");
    const author = busiest!;
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const response = await page.goto(
      `/news/dev/${encodeURIComponent(author.handle)}`,
    );
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: author.display_name }),
    ).toBeVisible();
    const shown = await page.locator("article").count();
    expect(shown).toBeLessThanOrEqual(20);
    if (author.post_count > 20) {
      await expect(page.getByRole("link", { name: "Older" })).toBeVisible();
      await page.getByRole("link", { name: "Older" }).click();
      await expect(page).toHaveURL(/\?page=2$/);
      expect(await page.locator("article").count()).toBeGreaterThan(0);
      await expect(page.getByRole("link", { name: "Newer" })).toBeVisible();
    }
    // docs/legal/obligations.md names the author page among the footers the disclaimer must be on.
    await expect(
      page.getByRole("contentinfo").getByTestId("disclaimer"),
    ).toHaveText(DISCLAIMER);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, "page scrolls sideways").toBe(false);
    await context.close();
  });

  const SCREENS = [
    { name: "news-dev-populated", path: "/news/dev" },
    {
      name: "news-dev-author",
      path:
        busiest === undefined
          ? "/news/dev"
          : `/news/dev/${encodeURIComponent(busiest.handle)}`,
    },
  ] as const;
  const VIEWPORTS = [
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 800 },
  ] as const;
  for (const screen of SCREENS) {
    for (const viewport of VIEWPORTS) {
      for (const scheme of ["light", "dark"] as const) {
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
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          );
          expect(overflow, "page scrolls sideways").toBe(false);
          mkdirSync(OUT, { recursive: true });
          // The first screen's worth: a year of posts makes a full-page shot tens of thousands
          // of pixels tall and says nothing more.
          await page.screenshot({
            path: join(OUT, `${screen.name}-${viewport.name}-${scheme}.png`),
            clip: { x: 0, y: 0, width: viewport.width, height: 1600 },
            fullPage: true,
          });
          await context.close();
        });
      }
    }
  }
});
