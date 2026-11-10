import { expect, test } from "@playwright/test";

// The news feed and the dev tracker over the committed news pack (spec 03, ADR-027). The pack
// holds Comm-Links and roadmap changes; Spectrum stays off until the approval box is ticked,
// so the tracker is its empty state and no author page exists.

test("the feed pages by twenty, links every item to its source and credits the wiki", async ({
  page,
}) => {
  await page.goto("/news");
  const items = page.locator("article");
  await expect(items).toHaveCount(20);
  const links = page.getByRole("link", { name: "Read on the source site" });
  await expect(links).toHaveCount(20);
  for (const href of await links.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")),
  )) {
    expect(href).toMatch(/^https:\/\/robertsspaceindustries\.com\//);
  }
  await expect(
    page.getByRole("link", {
      name: "Comm-Link text via the Star Citizen Wiki API",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Older" }).click();
  await expect(page).toHaveURL(/\/news\?page=2$/);
  await expect(page.locator("article")).toHaveCount(20);
  await expect(page.getByRole("link", { name: "Newer" })).toBeVisible();
});

test("the source filter keeps one source; the chips are drawn once the pack holds more than one", async ({
  page,
}) => {
  await page.goto("/news?source=comm_link");
  const sources = page.locator("article p.lab span.text-primary");
  expect(await sources.count()).toBeGreaterThan(0);
  for (const text of await sources.allTextContents()) {
    expect(text).toBe("Comm-Link");
  }
  // The pack as committed holds Comm-Links and, once the board has changed since the state on
  // file, roadmap items; the chips appear only when a second source is present.
  const nav = page.getByRole("navigation", { name: "Sources" });
  if ((await nav.count()) > 0) {
    await expect(nav.getByRole("link", { name: "Comm-Link" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  }
});

test("the RSS and JSON feeds answer with the newest items", async ({
  request,
}) => {
  const rss = await request.get("/news/rss.xml");
  expect(rss.status()).toBe(200);
  expect(rss.headers()["content-type"]).toMatch(/xml/);
  const xml = await rss.text();
  expect(xml).toContain('<rss version="2.0"');
  expect((xml.match(/<item>/g) ?? []).length).toBe(50);
  const json = await request.get("/news/feed.json");
  expect(json.status()).toBe(200);
  const feed = (await json.json()) as { version: string; items: unknown[] };
  expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
  expect(feed.items).toHaveLength(50);
});

test("the dev tracker is empty while Spectrum is off, and no author page exists", async ({
  page,
}) => {
  const response = await page.goto("/news/dev");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Developer posts" }),
  ).toBeVisible();
  await expect(page.getByText("Tracker not yet connected")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "News sections" }),
  ).toHaveCount(0);
  const author = await page.goto("/news/dev/nobody");
  expect(author?.status()).toBe(404);
});
