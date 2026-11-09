import { expect, test } from "@playwright/test";
import { FUNDING_INSPIRATION } from "../../../packages/ui/legal";

// ADR-018: the funding page. Headline figures, every section, the measure as URL state, the
// credits, and no sideways scroll on a phone.

test("shows the counters, every section and the credits, with Funding current in the nav", async ({
  page,
}) => {
  const response = await page.goto("/funding");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Funding");
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Funding" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Total pledged")).toBeVisible();
  for (const id of [
    "years",
    "months",
    "year-vs-year",
    "trend",
    "daily",
    "sources",
  ]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  // The long hole is stated, not estimated.
  await expect(page.locator("#months")).toContainText("No snapshots from");
  await expect(page.locator("#sources")).toContainText("Star Citizen Wiki API");
  await expect(
    page
      .locator("#sources")
      .getByRole("link", { name: FUNDING_INSPIRATION.linkText }),
  ).toHaveAttribute("href", FUNDING_INSPIRATION.url);
  // Every chart is described for assistive tech and carries hover titles.
  expect(
    await page.locator("main svg[role='img']").count(),
  ).toBeGreaterThanOrEqual(3);
  expect(await page.locator("main svg title").count()).toBeGreaterThan(100);
});

test("the measure is URL state", async ({ page }) => {
  await page.goto("/funding");
  await page
    .getByRole("navigation", { name: "Measure" })
    .getByRole("link", { name: "Citizens" })
    .click();
  await expect(page).toHaveURL(/\/funding\?measure=citizens$/);
  await expect(
    page.getByText("Citizens", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator("#years")).toContainText("joined");
  await page
    .getByRole("navigation", { name: "Measure" })
    .getByRole("link", { name: "Pledges" })
    .click();
  await expect(page).toHaveURL(/\/funding$/);
});

test("the month table is there for exact figures", async ({ page }) => {
  await page.goto("/funding");
  const details = page.locator("#months details");
  await details.locator("summary").click();
  await expect(details.getByRole("table")).toBeVisible();
  await expect(details.getByRole("rowheader", { name: "2021" })).toBeVisible();
});

test("fits a phone without sideways scroll", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/funding");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  // The wide table is hidden on phones; the per-year blocks stand in.
  await expect(page.locator("#months table").first()).toBeHidden();
  await context.close();
});
