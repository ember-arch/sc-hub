import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { eventForFront } from "schema";
import { DISCLAIMER } from "../../../packages/ui/legal";
import { clock, shows } from "./shows";

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

  test("a post's pictures are plates served by the site or captioned placeholders, never hotlinks to Spectrum (ADR-037)", async ({
    page,
  }) => {
    await page.goto("/news/dev");
    // No img anywhere in a post body points at RSI's hosts; no bare upload marker is left.
    const sources = await page
      .locator(".dev-post-body img")
      .evaluateAll((imgs) =>
        imgs.map((img) => ({
          src: img.getAttribute("src"),
          upload: img.getAttribute("data-upload"),
          inPlate: img.closest("figure.dev-post-plate") !== null,
          alt: img.getAttribute("alt"),
        })),
      );
    for (const img of sources) {
      expect(img.src, JSON.stringify(img)).toMatch(/^(\/media\/|https?:\/\/)/);
      expect(img.src).not.toMatch(/robertsspaceindustries\.com/);
      expect(img.upload).toBeNull();
      expect(img.inPlate).toBe(true);
      expect(img.alt).toBe("");
    }
    // Every plate, with a picture or pending one, carries CIG's credit linked to the post.
    const plates = page.locator(".dev-post-body figure.dev-post-plate");
    for (const credit of await plates
      .locator("figcaption a")
      .evaluateAll((as) =>
        as.map((a) => ({ text: a.textContent, href: a.getAttribute("href") })),
      )) {
      expect(credit.text).toBe("Image: Cloud Imperium Games, via Spectrum");
      expect(credit.href).toMatch(
        /^https:\/\/robertsspaceindustries\.com\/spectrum\//,
      );
    }
    expect(await plates.count()).toBe(
      await plates.locator("figcaption a").count(),
    );
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

  test("the home page features the developers' latest posts, three to five, one per thread, folded (ADR-038)", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=developers]");
    await expect(
      section.getByRole("heading", { name: "Developer gold posts" }),
    ).toBeVisible();
    // The page's title is a show's (ADR-057) or the lead story's (ADR-058), never a Spectrum post's.
    await expect(
      page.locator(
        eventForFront(shows, clock) === null
          ? "section[aria-labelledby=lead-story] h1"
          : "#front-event",
      ),
    ).toBeVisible();
    await expect(
      section.getByRole("link", { name: "All developer gold posts" }),
    ).toHaveAttribute("href", "/news/dev");
    const cards = section.locator("article");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(5);
    // One card per thread: the thread links are distinct.
    const threads = await cards.evaluateAll((articles) =>
      articles.map((a) => {
        const links = [...a.querySelectorAll("footer a")].map((l) =>
          l.getAttribute("href"),
        );
        // The thread's own page is the post's address without the post number.
        return (links[0] ?? "").replace(/\/\d+$/, "");
      }),
    );
    expect(new Set(threads).size).toBe(count);
    // Folded, with the Spectrum link visible, like the tracker's.
    await expect(cards.first().locator(".dev-post-body")).toBeHidden();
    await expect(
      cards.first().getByRole("link", { name: "View on Spectrum" }),
    ).toBeVisible();
    // The developers' section sits under the featured ships and above the funding.
    const tops = await page.evaluate(() =>
      ["featured", "developers", "funding"].map(
        (id) =>
          document
            .querySelector(`section[aria-labelledby=${id}]`)
            ?.getBoundingClientRect().top ?? -1,
      ),
    );
    expect(tops[0]).toBeLessThan(tops[1]!);
    expect(tops[1]).toBeLessThan(tops[2]!);
  });

  const SCREENS = [
    // The home with the developers' section drawn (ADR-038).
    { name: "home-populated", path: "/" },
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
  // A post opened, the first with a picture on the page (ADR-037): the record of the plate and
  // the post's own blocks across the card. Falls back to the first post where none has one.
  for (const viewport of VIEWPORTS) {
    for (const scheme of ["light", "dark"] as const) {
      test(`news-dev-post-open at ${viewport.width} px, ${scheme}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto("/news/dev");
        const withPlate = page.locator("article", {
          has: page.locator("figure.dev-post-plate"),
        });
        const article =
          (await withPlate.count()) > 0
            ? withPlate.first()
            : page.locator("article").first();
        await article.locator("summary").click();
        await expect(article.locator("details")).toHaveAttribute("open", "");
        await expect(article.getByText("Fold the post")).toBeVisible();
        // The post's text is hidden from the summary once open; the body shows instead.
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow, "page scrolls sideways").toBe(false);
        // The plates load lazily: scroll the post through like a reader, then wait for every
        // picture in it to have loaded, so the record shows them and not their frames.
        const box = await article.boundingBox();
        for (let y = 0; y < (box?.height ?? 0); y += 600) {
          await page.evaluate(
            (top) => window.scrollTo(0, top),
            (box?.y ?? 0) + y,
          );
          await page.waitForTimeout(60);
        }
        await expect
          .poll(
            () =>
              article
                .locator("figure.dev-post-plate img")
                .evaluateAll((imgs) =>
                  imgs.every(
                    (img) =>
                      (img as HTMLImageElement).complete &&
                      (img as HTMLImageElement).naturalWidth > 0,
                  ),
                ),
            { timeout: 20_000 },
          )
          .toBe(true);
        mkdirSync(OUT, { recursive: true });
        await article.screenshot({
          path: join(OUT, `news-dev-post-open-${viewport.name}-${scheme}.png`),
        });
        await context.close();
      });
    }
  }

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
            // The home is recorded whole (its posts are folded); the tracker's pages are cut.
            ...(screen.name === "home-populated"
              ? {}
              : { clip: { x: 0, y: 0, width: viewport.width, height: 1600 } }),
            fullPage: true,
          });
          await context.close();
        });
      }
    }
  }
});
