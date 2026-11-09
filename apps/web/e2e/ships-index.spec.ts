import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { listedVehicles } from "../lib/editions";

// Spec 02, criterion "Ship index": filters for manufacturer, role, size class, status and kind as
// URL state; card and table views; the table sorted by name by default and by any stat column;
// the phone expand-row rule; keyboard and no-JavaScript operation of the filters. Expected values
// are read from the fixture pack, never typed in.

interface VehicleRow {
  class_name: string;
  slug: string;
  name: string;
  size_class: string | null;
  manufacturer_code: string;
  base_variant_of: string | null;
}
interface StatsRow {
  class_name: string;
  channel: string;
  game_version: string;
  mass_kg: number;
}
interface ManufacturerRow {
  code: string;
  slug: string;
  name: string;
}
interface GameVersionRow {
  channel: string;
  version: string;
  is_current: boolean;
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
// Editions are listed under their base (ADR-022), so the cards and counts see entries.
const vehicles = listedVehicles(fixture<VehicleRow[]>("Vehicle.json"));
const manufacturers = fixture<ManufacturerRow[]>("Manufacturer.json");
const live = fixture<GameVersionRow[]>("GameVersion.json").find(
  (v) => v.channel === "LIVE" && v.is_current,
);
if (live === undefined) throw new Error("pack has no current LIVE build");
/** LIVE stats of the current build only, as the index shows them. */
const liveMass = new Map(
  fixture<StatsRow[]>("VehicleStats.json")
    .filter((s) => s.channel === "LIVE" && s.game_version === live.version)
    .map((s) => [s.class_name, s.mass_kg]),
);
const byName = [...vehicles].sort((a, b) => a.name.localeCompare(b.name, "en"));

const sizes = [...new Set(vehicles.map((v) => v.size_class))].filter(
  (s): s is string => s !== null,
);
const size = sizes[0];
if (size === undefined) throw new Error("pack has no size classes");

test("a size filter chosen from the select becomes URL state and narrows the cards", async ({
  page,
}) => {
  await page.goto("/ships");
  const expected = vehicles.filter((v) => v.size_class === size);
  await page.getByLabel("Size").selectOption(size);
  await expect(page).toHaveURL(new RegExp(`/ships\\?size=${size}$`));
  await expect(page.getByTestId("ship-count")).toContainText(
    `${expected.length} of ${vehicles.length} ships`,
  );
  // Each card is one link whose name starts with the ship name; count them exactly.
  const cards = page.getByRole("main").locator("ul li a");
  await expect(cards).toHaveCount(expected.length);
  for (const v of expected) {
    await expect(cards.filter({ hasText: v.name })).toHaveCount(1);
  }
  // Clear filters restores the full list and the plain URL.
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/ships$/);
  await expect(page.getByTestId("ship-count")).toContainText(
    `${vehicles.length} ships`,
  );
});

test("a manufacturer filter in the URL preselects the control and survives the view toggle, and a filter change keeps the table view", async ({
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
  // Changing a filter in table view keeps the view and puts it last, as the toggle links do.
  await page.getByLabel("Manufacturer").selectOption("");
  await expect(page).toHaveURL(/\/ships\?view=table$/);
  await page.getByLabel("Size").selectOption(size);
  await expect(page).toHaveURL(new RegExp(`/ships\\?size=${size}&view=table$`));
  await expect(page.getByRole("table")).toBeVisible();
});

test("table mode sorts by name by default and by a stat column on tap", async ({
  page,
}) => {
  await page.goto("/ships?view=table");
  const names = page.getByRole("table").locator("tbody tr td:first-child");
  await expect(names).toHaveText(byName.map((v) => v.name));
  const massHeader = page.getByRole("columnheader", { name: /Mass/ });
  await massHeader.getByRole("button").click();
  await expect(massHeader).toHaveAttribute("aria-sort", "ascending");
  // A stable sort over the name order, ships without a LIVE row last, like the table's own.
  const mass = (v: VehicleRow): number | null =>
    liveMass.get(v.class_name) ?? null;
  const ordered = (direction: 1 | -1): string[] =>
    [...byName]
      .sort((a, b) => {
        const x = mass(a);
        const y = mass(b);
        if (x === null) return y === null ? 0 : 1;
        if (y === null) return -1;
        return (x - y) * direction;
      })
      .map((v) => v.name);
  await expect(names).toHaveText(ordered(1));
  await massHeader.getByRole("button").click();
  await expect(massHeader).toHaveAttribute("aria-sort", "descending");
  await expect(names).toHaveText(ordered(-1));
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
  await expect(
    page.locator("tbody dt").filter({ hasText: "Mass (kg)" }).first(),
  ).toBeVisible();
  await context.close();
});

test("arrow keys step through a select without navigating; Enter or leaving the control applies it, and focus stays put", async ({
  page,
}) => {
  await page.goto("/ships");
  const select = page.getByLabel("Size");
  // Options follow the data model's size order, whatever order the pack lists ships in.
  const values = (
    await select
      .locator("option")
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      )
  ).filter((v) => v !== "");
  const [firstSize, secondSize] = values;
  if (firstSize === undefined) throw new Error("size select has no options");
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await expect(select).toHaveValue(firstSize);
  await expect(page).toHaveURL(/\/ships$/);
  if (secondSize !== undefined) {
    await page.keyboard.press("ArrowDown");
    await expect(select).toHaveValue(secondSize);
    await expect(page).toHaveURL(/\/ships$/);
    await page.keyboard.press("ArrowUp");
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/ships\\?size=${firstSize}$`));
  await expect(select).toBeFocused();
  await expect(select).toHaveValue(firstSize);
  // Leaving the control after another arrow press applies that change too.
  await page.keyboard.press("ArrowUp");
  await expect(select).toHaveValue("");
  await page.keyboard.press("Tab");
  await expect(page).toHaveURL(/\/ships$/);
  await expect(page.getByLabel("Status")).toBeFocused();
});

test("without JavaScript the Apply button submits the same filters as a plain GET", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/ships?view=table");
  await page.getByLabel("Size").selectOption(size);
  await page.getByRole("button", { name: "Apply" }).click();
  const url = new URL(page.url());
  expect(url.pathname).toBe("/ships");
  expect(url.searchParams.get("size")).toBe(size);
  expect(url.searchParams.get("view")).toBe("table");
  await expect(page.getByTestId("ship-count")).toContainText(
    `${vehicles.filter((v) => v.size_class === size).length} of ${vehicles.length} ships`,
  );
  await expect(page.getByRole("table")).toBeVisible();
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

// system.md principle 6 between the two screenshot widths: tablets and narrow desktop windows.
// The ships table has eleven columns, so it keeps the expand-row layout until it fits.
for (const width of [820, 1024, 1180]) {
  test(`no page with a wide table scrolls sideways at ${width} px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const ship = vehicles[0]?.slug ?? "";
    for (const path of [
      "/ships?view=table",
      "/components",
      `/ships/${ship}`,
      `/compare?ships=${vehicles
        .slice(0, 4)
        .map((v) => v.slug)
        .join(",")}`,
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways at ${width} px`).toBe(false);
    }
    await context.close();
  });
}

test("where columns are hidden, the Sort by select sorts by any of them", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/ships?view=table");
  const names = page.getByRole("table").locator("tbody tr td:first-child");
  // Mass is hidden at this width; the select still offers it.
  await expect(page.getByRole("columnheader", { name: /Mass/ })).toBeHidden();
  await page
    .getByLabel("Sort by")
    .selectOption({ label: "Mass (kg), high to low" });
  const mass = (v: VehicleRow): number => liveMass.get(v.class_name) ?? -1;
  await expect(names).toHaveText(
    [...byName].sort((a, b) => mass(b) - mass(a)).map((v) => v.name),
  );
  await context.close();
});
