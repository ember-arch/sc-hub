import { expect, test } from "@playwright/test";

// The videos (ADR-050): the news page's third tab and the front page's row, over the committed
// news pack, which holds CIG's uploads on its two YouTube channels. Every card links YouTube;
// a press opens the privacy-enhanced player in place, and closing it unloads the player.

test("the videos tab lists the uploads newest first, each linked to YouTube, with a chip per channel", async ({
  page,
}) => {
  const response = await page.goto("/news/videos");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Videos" }),
  ).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "News sections" });
  await expect(tabs.getByRole("link", { name: "Videos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(tabs.getByRole("link", { name: "Dispatches" })).toBeVisible();
  const cards = page.locator("article[data-video]");
  expect(await cards.count()).toBeGreaterThan(0);
  const times = await cards
    .locator("time")
    .evaluateAll((ts) => ts.map((t) => t.getAttribute("datetime") ?? ""));
  expect([...times].sort().reverse()).toEqual(times);
  const out = page.getByRole("link", { name: /^Watch .+ on YouTube$/ });
  expect(await out.count()).toBe(await cards.count());
  for (const href of await out.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")),
  )) {
    expect(href).toMatch(
      /^https:\/\/www\.youtube\.com\/(watch\?v=|shorts\/)[A-Za-z0-9_-]{11}$/,
    );
  }
  await expect(
    page.getByText("Videos: Cloud Imperium Games, on YouTube"),
  ).toBeVisible();
  // CLAUDE.md section 2: no emoji anywhere in the UI, though some of CIG's titles carry them.
  const text = (await page.locator("main").textContent()) ?? "";
  // The trademark signs are typography, kept as `withoutEmoji` keeps them.
  expect(text.replace(/[\u00A9\u00AE\u2122]/gu, "")).not.toMatch(
    /\p{Extended_Pictographic}/u,
  );
  const channels = page.getByRole("navigation", { name: "Channels" });
  await channels.getByRole("link", { name: "Squadron 42" }).click();
  await expect(page).toHaveURL(/channel=Squadron(%20|\+)42$/);
  for (const text of await page
    .locator("article[data-video] p.lab span.text-primary")
    .allTextContents()) {
    expect(text).toBe("Squadron 42");
  }
});

test("a press on a video opens the player in place; Escape closes it and unloads the player", async ({
  page,
}) => {
  await page.goto("/news/videos");
  // Nothing of YouTube's player is in the page until a reader asks for it.
  await expect(page.locator("iframe")).toHaveCount(0);
  const card = page.locator("article[data-video]").first();
  const title = (await card.locator("h3 a").innerText()).trim();
  await card.locator("h3 a").click();
  const player = page.getByRole("dialog", { name: title });
  await expect(player).toBeVisible();
  await expect(player.locator("iframe")).toHaveAttribute(
    "src",
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1&rel=0/,
  );
  // Without "autoplay" in the frame's allow list, the address's autoplay=1 does nothing.
  await expect(player.locator("iframe")).toHaveAttribute(
    "allow",
    /\bautoplay\b/,
  );
  await expect(
    player.getByRole("button", { name: "Close the video" }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\/news\/videos$/);
  await page.keyboard.press("Escape");
  await expect(player).toBeHidden();
  await expect(page.locator("dialog iframe")).toHaveCount(0);
  await expect(card.locator("h3 a")).toBeFocused();
  // The close button, and a press on the dimmed page around the player, close it too.
  await card.locator("h3 a").click();
  await player.getByRole("button", { name: "Close the video" }).click();
  await expect(player).toBeHidden();
  await card.locator("h3 a").click();
  await expect(player).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(player).toBeHidden();
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("a press with a modifier key leaves the player closed, as a link to YouTube", async ({
  page,
  context,
}) => {
  await page.goto("/news/videos");
  const link = page.locator("article[data-video] h3 a").first();
  const opened = context.waitForEvent("page");
  await link.click({ modifiers: ["Control"] });
  const tab = await opened;
  expect(tab.url()).toMatch(/^https:\/\/(www|consent)\.youtube\.com\//);
  await tab.close();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the front page's videos open the player too", async ({ page }) => {
  await page.goto("/");
  const card = page
    .locator("section[aria-labelledby='videos'] article[data-video]")
    .first();
  await card.locator("h3 a").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the dispatches leave videos to their tab", async ({ page }) => {
  await page.goto("/news?source=video");
  for (const text of await page
    .locator("article p.lab span.text-primary")
    .allTextContents()) {
    expect(text).not.toBe("Video");
  }
  await expect(
    page.getByRole("navigation", { name: "Sources" }).getByRole("link", {
      name: "Video",
    }),
  ).toHaveCount(0);
});

test("the front page carries the latest videos as a row, the newest first, with a link to the tab", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby='videos']");
  await expect(
    section.getByRole("heading", { name: "Latest videos" }),
  ).toBeVisible();
  const cards = section.locator("article[data-video]");
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(5);
  expect(count).toBeLessThanOrEqual(7);
  await expect(
    section.getByRole("link", { name: "All videos" }),
  ).toHaveAttribute("href", "/news/videos");
  // One row that scrolls sideways, not a column: the cards share a top edge.
  const tops = await cards.evaluateAll((as) =>
    as.map((a) => Math.round(a.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);
});

test("on a phone the front page's sections are rows to swipe, and the page does not scroll sideways", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  for (const id of ["dispatches", "videos", "featured"]) {
    const cards = page.locator(`section[aria-labelledby='${id}'] li`);
    if ((await cards.count()) < 2) continue;
    const tops = await cards.evaluateAll((ls) =>
      ls.map((l) => Math.round(l.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size, id).toBe(1);
  }
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(wide).toBe(false);
  await context.close();
});
