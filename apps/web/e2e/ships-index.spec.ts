import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 02, criterion "Ship index": filters for manufacturer, role, size class, status and kind as
// URL state; card and table views; the table sorted by name by default and by any stat column;
// the phone expand-row rule. Expected values are read from the fixture pack, never typed in.

interface VehicleRow {
  class_name: string;
  slug: string;
  name: string;
  size_class: string | null;
  manufacturer_code: string;
}
interface StatsRow {
  class_name: string;
  mass_kg: number;
}
interface ManufacturerRow {
  code: string;
  slug: string;
  name: string;
}
const fixture = <T>(file: string): T =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../fixtures/bootstrap/${file}`, import.meta.url),
      ),
      "utf8",
    ),
  ) as T;
const vehicles = fixture<VehicleRow[]>("Vehicle.json");
const manufacturers = fixture<ManufacturerRow[]>("Manufacturer.json");
const stats = fixture<StatsRow[]>("VehicleStats.json");

test("a size filter chosen from the select becomes URL state and narrows the cards", async ({
  page,
}) => {
  await page.goto("/ships");
  const sizes = [...new Set(vehicles.map((v) => v.size_class))].filter(
    (s): s is string => s !== null,
  );
  const size = sizes[0];
  if (size === undefined) throw new Error("pack has no size classes");
  const expected = vehicles.filter((v) => v.size_class === size);
  await page.getByLabel("Size").selectOption(size);
  await expect(page).toHaveURL(new RegExp(`/ships\\?size=${size}$`));
  await expect(page.getByTestId("ship-count")).toContainText(
    `${expected.length} of ${vehicles.length} ships`,
  );
  const cards = page.getByRole("main").getByRole("link", {
    name: new RegExp(expected.map((v) => v.name).join("|")),
  });
  await expect(cards).toHaveCount(expected.length);
  // Clear filters restores the full list and the plain URL.
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/ships$/);
  await expect(page.getByTestId("ship-count")).toContainText(
    `${vehicles.length} ships`,
  );
});

test("a manufacturer filter in the URL preselects the control and survives the view toggle", async ({
  page,
}) => {
  const first = vehicles[0];
  const maker = manufacturers.find((m) => m.code === first?.manufacturer_code);
  if (first === undefined || maker === undefined)
    throw new Error("pack has no vehicle with a manufacturer");
  await page.goto(`/ships?manufacturer=${maker.slug}`);
  await expect(page.getByLabel("Manufacturer")).toHaveValue(maker.slug);
  await page
    .getByRole("navigation", { name: "View" })
    .getByRole("link", { name: "Table" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/ships\\?manufacturer=${maker.slug}&view=table$`),
  );
  await expect(page.getByLabel("Manufacturer")).toHaveValue(maker.slug);
  const rows = page.getByRole("table").locator("tbody tr");
  await expect(rows).toHaveCount(
    vehicles.filter((v) => v.manufacturer_code === maker.code).length,
  );
});

test("table mode sorts by name by default and by a stat column on tap", async ({
  page,
}) => {
  await page.goto("/ships?view=table");
  const names = page.getByRole("table").locator("tbody tr td:first-child");
  const byName = [...vehicles]
    .map((v) => v.name)
    .sort((a, b) => a.localeCompare(b, "en"));
  await expect(names).toHaveText(byName);
  const massHeader = page.getByRole("columnheader", { name: /Mass/ });
  await massHeader.getByRole("button").click();
  await expect(massHeader).toHaveAttribute("aria-sort", "ascending");
  const byMass = [...stats]
    .sort((a, b) => a.mass_kg - b.mass_kg)
    .map((s) => vehicles.find((v) => v.class_name === s.class_name)?.name)
    .filter((n): n is string => n !== undefined);
  expect(byMass).toHaveLength(vehicles.length);
  await expect(names).toHaveText(byMass);
  await massHeader.getByRole("button").click();
  await expect(massHeader).toHaveAttribute("aria-sort", "descending");
  await expect(names).toHaveText([...byMass].reverse());
});

test("on a phone the table keeps name and cargo and expands a row for the rest", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/ships?view=table");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow, "page scrolls sideways").toBe(false);
  await expect(page.getByRole("columnheader", { name: /Name/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Cargo/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Mass/ })).toBeHidden();
  const more = page.getByRole("button", { name: "More" }).first();
  await more.click();
  await expect(
    page.getByRole("button", { name: "Less" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Mass (kg)").first()).toBeVisible();
  await context.close();
});

test("the components index filters by size and manufacturer as URL state", async ({
  page,
}) => {
  await page.goto("/components");
  await page.getByLabel("Size").selectOption({ index: 1 });
  await expect(page).toHaveURL(/\/components\?size=\d+$/);
  await expect(page.getByTestId("component-count")).toContainText(" of ");
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/components$/);
});
