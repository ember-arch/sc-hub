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
  // Every chart is a figure with a sentence for assistive tech; the drawing is hidden from it
  // and carries a title per mark for pointer readers.
  const figures = page.locator("main figure");
  expect(await figures.count()).toBeGreaterThanOrEqual(3);
  for (const figure of await figures.all()) {
    await expect(figure.locator("figcaption")).toHaveText(/\d/);
    await expect(figure.locator("svg").first()).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  }
  await expect(
    page.locator("#year-vs-year svg title", { hasText: /^Day 1\n/ }),
  ).toHaveCount(1);
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
  // The plots keep a real height on a phone (2:1 of their width), not the SVG's default.
  for (const box of await page.locator("main figure svg").all()) {
    const rect = await box.boundingBox();
    expect(rect?.height ?? 0).toBeGreaterThan(120);
  }
  // The wide table is hidden on phones; the per-year blocks stand in.
  await expect(page.locator("#months table").first()).toBeHidden();
  await context.close();
});
