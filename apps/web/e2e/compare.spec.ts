import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { listedVehicles } from "../lib/editions";

// Spec 02, criterion "Compare": /compare?ships=a,b,c,d shows up to four ships side by side on
// the key-facts set and the full stats table, shareable by URL, with add and remove from the
// ship page and the index. Expected values come from the fixture pack.

interface VehicleRow {
  class_name: string;
  slug: string;
  name: string;
  manufacturer_code: string;
  base_variant_of: string | null;
}
interface StatsRow {
  class_name: string;
  mass_kg: number;
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
// Editions are listed under their base (ADR-022), so the chooser and the counts see entries.
const vehicles = listedVehicles(fixture<VehicleRow[]>("Vehicle.json"));
const stats = fixture<StatsRow[]>("VehicleStats.json");
const [a, b, c, d, e] = vehicles;
if (a === undefined || b === undefined || c === undefined)
  throw new Error("pack needs at least three ships");

test("a shared URL renders each ship as a column with key facts and the stats table", async ({
  page,
}) => {
  await page.goto(`/compare?ships=${a.slug},${b.slug}`);
  await expect(page.getByTestId("compare-count")).toContainText("2 of 4 ships");
  const table = page.getByRole("table", { name: "Ships compared" });
  await expect(table.getByRole("columnheader", { name: a.name })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: b.name })).toBeVisible();
  await expect(table.getByRole("rowgroup").first()).toBeVisible();
  for (const label of ["Manufacturer", "Crew", "Cargo (SCU)", "Mass (kg)"]) {
    await expect(
      table.getByRole("rowheader", { name: label }).first(),
    ).toBeVisible();
  }
  const massA = stats.find((s) => s.class_name === a.class_name)?.mass_kg;
  if (massA !== undefined) {
    await expect(table).toContainText(massA.toLocaleString("en-US"));
  }
});

test("remove links drop one ship from the URL; a fifth ship is left out with a note", async ({
  page,
}) => {
  await page.goto(`/compare?ships=${a.slug},${b.slug},${c.slug}`);
  await page
    .getByRole("link", { name: `Remove ${b.name} from the comparison` })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/compare\\?ships=${a.slug},${c.slug}$`),
  );
  await expect(page.getByTestId("compare-count")).toContainText("2 of 4 ships");
  if (d !== undefined && e !== undefined) {
    await page.goto(
      `/compare?ships=${a.slug},${b.slug},${c.slug},${d.slug},${e.slug}`,
    );
    await expect(page.getByTestId("compare-count")).toContainText(
      "4 of 4 ships",
    );
    await expect(page.getByText(`${e.slug} was left out`)).toBeVisible();
  }
  await page.goto(`/compare?ships=${a.slug},no-such-ship`);
  await expect(page.getByText("No ship named no-such-ship")).toBeVisible();
  await expect(page.getByTestId("compare-count")).toContainText("1 of 4 ships");
});

test("the add select appends a ship and the URL stays canonical", async ({
  page,
}) => {
  await page.goto(`/compare?ships=${a.slug}`);
  await page.getByLabel("Add a ship", { exact: true }).selectOption(b.slug);
  await expect(page).toHaveURL(
    new RegExp(`/compare\\?ships=${a.slug},${b.slug}$`),
  );
  await expect(page.getByTestId("compare-count")).toContainText("2 of 4 ships");
});

test("compare toggles on the ship page and the index feed the compare link", async ({
  page,
}) => {
  await page.goto(`/ships/${a.slug}`);
  const toggle = page.getByRole("button", { name: `Compare ${a.name}` });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: "Compare 1 ship" }),
  ).toBeVisible();
  await page.goto("/ships");
  await page.getByRole("button", { name: `Compare ${b.name}` }).click();
  const link = page.getByRole("link", { name: "Compare 2 ships" });
  await expect(link).toHaveAttribute(
    "href",
    `/compare?ships=${a.slug},${b.slug}`,
  );
  await link.click();
  await expect(page).toHaveURL(
    new RegExp(`/compare\\?ships=${a.slug},${b.slug}$`),
  );
  // Removing on the compare page updates the basket the index reads.
  await page
    .getByRole("link", { name: `Remove ${a.name} from the comparison` })
    .click();
  await expect(page).toHaveURL(`/compare?ships=${b.slug}`);
  await expect(page.getByTestId("compare-count")).toContainText("1 of 4 ships");
  await page.goto("/ships");
  await expect(
    page.getByRole("button", { name: `Compare ${a.name}` }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: `Compare ${b.name}` }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("on a phone the comparison stacks instead of scrolling sideways", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const four = vehicles.slice(0, 4).map((v) => v.slug);
  await page.goto(`/compare?ships=${four.join(",")}`);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow, "page scrolls sideways").toBe(false);
  await expect(
    page.getByRole("table", { name: "Ships compared" }),
  ).toBeHidden();
  await expect(page.getByRole("region", { name: "Key facts" })).toBeVisible();
  await context.close();
});
