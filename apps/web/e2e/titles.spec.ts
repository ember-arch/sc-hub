import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { TITLES_TEXT_CREDIT } from "../../../packages/ui/legal";

// ADR-017: the titles page. Filters are URL state, every title has an anchor, the wiki's text is
// credited with its licence, and the page renders with or without locally built icons.

const here = dirname(fileURLToPath(import.meta.url));
const mediaBuilt = existsSync(
  join(here, "..", "public", "media", "manifest.json"),
);

test("lists every group with the wiki's text credited and the nav marking Titles", async ({
  page,
}) => {
  const response = await page.goto("/titles");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Titles");
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Titles" }),
  ).toHaveAttribute("aria-current", "page");
  const groups = page.locator("main section[aria-labelledby$='-heading']");
  // Ten groups and the sources section.
  await expect(groups).toHaveCount(11);
  const sources = page.locator("#sources");
  await expect(sources).toContainText("Star Citizen Wiki");
  await expect(
    sources.getByRole("link", { name: TITLES_TEXT_CREDIT.licence }),
  ).toHaveAttribute("href", TITLES_TEXT_CREDIT.licenceUrl);
  await expect(sources).toContainText(TITLES_TEXT_CREDIT.changes);
  await expect(page.locator("#backer-legatus")).toContainText("$25,000");
});

test("search, group and status are URL state, and clear filters resets them", async ({
  page,
}) => {
  await page.goto("/titles");
  const search = page.getByRole("searchbox", { name: "Search titles" });
  // Typing submits on its own a moment later; retry until hydration has attached the handler.
  await expect(async () => {
    await search.fill("");
    await search.fill("legatus");
    await expect(page).toHaveURL(/\/titles\?q=legatus$/, { timeout: 2_000 });
  }).toPass();
  await expect(search).toBeFocused();
  await expect(page.getByTestId("title-count")).toHaveText(/^1 of \d+ titles$/);
  await expect(page.locator("#backer-legatus")).toBeVisible();
  await expect(page.locator("#guide")).toHaveCount(0);

  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/titles$/);
  await expect(search).toHaveValue("");

  await page.goto("/titles?group=guide&status=not-earnable");
  await expect(page.getByLabel("Group", { exact: true })).toHaveValue("guide");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "not-earnable",
  );
  await expect(page.locator("main section[id='guide']")).toBeVisible();
  await expect(page.locator("#guide-2950-red-flame")).toBeVisible();
  await expect(page.locator("#guide-mining-escort")).toHaveCount(0);

  await page.goto("/titles?q=nothing+is+called+this");
  await expect(page.getByText("No titles match these filters.")).toBeVisible();
});

test("a title's anchor scrolls it into view and the palette links to it", async ({
  page,
}) => {
  await page.goto("/titles#guide-mining-escort");
  await expect(page.locator("#guide-mining-escort")).toBeInViewport();

  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass();
  await dialog.getByRole("combobox").fill("legatus");
  await expect(dialog.getByRole("group", { name: "Titles" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/titles#backer-legatus$/);
  await expect(page.locator("#backer-legatus")).toBeInViewport();
});

test("fits a phone without sideways scroll", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/titles");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await context.close();
});

test("draws icons only where they were built, sized and without alt text", async ({
  page,
}) => {
  await page.goto("/titles");
  const icons = page.locator("main img");
  if (!mediaBuilt) {
    // CI and deploys have no icons (CIG art, local only): no image and no empty icon box.
    await expect(icons).toHaveCount(0);
    return;
  }
  expect(await icons.count()).toBeGreaterThan(0);
  for (const img of await icons.all()) {
    await expect(img).toHaveAttribute("alt", "");
    await expect(img).toHaveAttribute("width", /^\d+$/);
    await expect(img).toHaveAttribute("height", /^\d+$/);
  }
});
