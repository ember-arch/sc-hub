import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 02, criteria "Ship page", "PTU diff toggle" and "Component index and pages": every stat
// shows its unit and the version it comes from; the sections exist in order; the PTU toggle
// appears only when a PTU build differs (the pack has none, so its empty note shows); the
// component page shows stats by channel and the ships that carry it. Expected values are read
// from the fixture pack.

interface VehicleRow {
  class_name: string;
  slug: string;
  name: string;
}
interface StatsRow {
  class_name: string;
  game_version: string;
  mass_kg: number;
  length_m: number;
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
const vehicles = fixture<VehicleRow[]>("Vehicle.json");
const stats = fixture<StatsRow[]>("VehicleStats.json");
const versions = fixture<GameVersionRow[]>("GameVersion.json");
const live = versions.find((v) => v.channel === "LIVE" && v.is_current);
const ptu = versions.find((v) => v.channel === "PTU" && v.is_current);

const ship = vehicles[0];
const shipStats = stats.find((s) => s.class_name === ship?.class_name);
if (ship === undefined || shipStats === undefined || live === undefined)
  throw new Error("pack needs one ship with stats and a LIVE build");

test("the ship page has every section in order, each stat with its unit and version", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ship.name);
  const headings = page.getByRole("heading", { level: 2 });
  await expect(headings).toContainText([
    "Specifications",
    "Hardpoints and stock loadout",
    "Variants and paints",
    "Changed in this version",
    "In the news",
  ]);
  const specs = page.locator("#specs");
  await expect(specs).toContainText(`LIVE ${live.version}`);
  const mass = specs.locator("dt", { hasText: "Mass" }).locator("..");
  await expect(mass).toContainText("kg");
  await expect(mass).toContainText(shipStats.mass_kg.toLocaleString("en-US"));
  const length = specs.locator("dt", { hasText: "Length" }).locator("..");
  await expect(length).toContainText("m");
  await expect(page.locator("#hardpoints")).toContainText(
    `LIVE ${live.version}`,
  );
});

test("the PTU toggle shows only when a PTU build differs; otherwise the page says why", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  const toggle = page.getByRole("button", { name: /PTU differences/ });
  if (ptu === undefined) {
    await expect(toggle).toHaveCount(0);
    await expect(page.locator("#specs")).toContainText("No PTU build recorded");
  } else {
    // With a PTU build the specs aside names both channels; the toggle depends on the diff.
    await expect(page.locator("#specs")).toContainText(`PTU ${ptu.version}`);
  }
});

test("variants and paints, and changed in this version, show honest empty states on the bootstrap pack", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  await expect(page.locator("#variants")).toContainText(
    "No variants or paints in the current data pack",
  );
  await expect(page.locator("#changes")).toContainText(
    "No earlier LIVE version",
  );
});

test("a component page shows its stats with the version and the ships that carry it", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  const stock = page
    .locator("#hardpoints")
    .getByRole("link")
    .filter({ hasNot: page.locator("[aria-hidden]") })
    .first();
  const name = await stock.textContent();
  await stock.click();
  await expect(page).toHaveURL(/\/components\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name ?? "");
  await expect(page.locator("#stats")).toContainText(`LIVE ${live.version}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Stock on" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(ship.name) }).first(),
  ).toBeVisible();
});

test("an unknown slug returns 404 with the search box and the disclaimer", async ({
  page,
}) => {
  // Spec 02, criterion "Slugs and redirects" (the 404 half): unknown slugs 404 with a search box.
  const response = await page.goto("/ships/no-such-ship");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("button", { name: /Search ships/ }),
  ).toBeVisible();
  await expect(page.locator("footer").last()).toContainText(
    "unofficial Star Citizen fan site",
  );
});
