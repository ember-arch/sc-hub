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
interface PortRow {
  class_name: string;
  port_type: string;
  parent_port_path: string | null;
  default_item_class: string | null;
}
const ports = fixture<PortRow[]>("Port.json");
const stats = fixture<StatsRow[]>("VehicleStats.json");
const versions = fixture<GameVersionRow[]>("GameVersion.json");
const live = versions.find((v) => v.channel === "LIVE" && v.is_current);
const ptu = versions.find((v) => v.channel === "PTU" && v.is_current);

// The ship under test: the first one in the pack with a mounted item nested under another
// port (a turret's gun or a rack's missile), so the nesting assertions mean something.
const ship = vehicles.find((v) =>
  ports.some(
    (p) =>
      p.class_name === v.class_name &&
      p.parent_port_path !== null &&
      p.default_item_class !== null &&
      p.port_type !== "other",
  ),
);
const shipStats = stats.find((s) => s.class_name === ship?.class_name);
if (ship === undefined || shipStats === undefined || live === undefined)
  throw new Error("pack needs one ship with stats and a LIVE build");

// ADR-012, ADR-014: every ship page is the same ship file, nine numbered sections in one order.
const SECTIONS = [
  "Brief",
  "Acquisition and status",
  "Weapons and combat",
  "Crew and operations",
  "Mobility",
  "Scale",
  "Specifications",
  "Hardpoints and loadout",
  "Sources",
];

test("the ship page has every section in order, each stat with its unit and version", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ship.name);
  await expect(page.getByRole("heading", { level: 2 })).toContainText(SECTIONS);
  const specs = page.locator("#specifications");
  await expect(specs).toContainText(`LIVE ${live.version}`);
  const mass = specs.locator("dt", { hasText: "Mass" }).locator("..");
  await expect(mass).toContainText("kg");
  await expect(mass).toContainText(shipStats.mass_kg.toLocaleString("en-US"));
  const length = specs.locator("dt", { hasText: "Length" }).locator("..");
  await expect(length).toContainText("m");
  // Every section with game data names the build it comes from (spec 02, "Ship page").
  for (const id of ["combat", "operations", "mobility", "hardpoints"]) {
    await expect(page.locator(`#${id}`)).toContainText(`LIVE ${live.version}`);
  }
});

test("the PTU toggle shows only when a PTU build differs; otherwise the page says why", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  const toggle = page.getByRole("button", { name: /PTU differences/ });
  if (ptu === undefined) {
    await expect(toggle).toHaveCount(0);
    await expect(page.locator("#specifications")).toContainText(
      "No PTU build is on record",
    );
  } else {
    // With a PTU build the specs aside names both channels; the toggle depends on the diff.
    await expect(page.locator("#specifications")).toContainText(
      `PTU ${ptu.version}`,
    );
  }
});

test("every ship file, concept or flying, has the same sections in the same order", async ({
  page,
}) => {
  for (const slug of [ship.slug, "perseus", "odin"]) {
    await page.goto(`/ships/${slug}`);
    const titles = await page
      .locator("main h2[id$='-title']")
      .evaluateAll((hs) =>
        hs.map((h) => (h.textContent ?? "").replace(/^\d+/, "").trim()),
      );
    expect(titles, slug).toEqual(SECTIONS);
  }
  // Images sit in the sections they show (ADR-014), never in a gallery section of their own.
  await expect(page.getByRole("heading", { name: /Imagery/ })).toHaveCount(0);
  // A section with nothing on record says so rather than disappearing.
  await page.goto("/ships/odin");
  await expect(page.locator("#specifications")).toContainText(
    "Not in the game data yet",
  );
});

// ADR-013: pledge and in-game prices come from fixtures/acquisition/ and carry their sources.
interface OfferRow {
  slug: string;
  price_usd: number;
}
interface ShopPriceRow {
  class_name: string;
  kind: string;
  price_auec: number;
}
const acquisition = <T>(file: string): T =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../fixtures/acquisition/${file}`, import.meta.url),
      ),
      "utf8",
    ),
  ) as T;

test("Acquisition shows pledge and in-game prices with their sources", async ({
  page,
}) => {
  const offers = acquisition<OfferRow[]>("PledgeOffer.json");
  const shops = acquisition<ShopPriceRow[]>("ShopPrice.json");
  const sold = vehicles.find((v) =>
    shops.some((s) => s.class_name === v.class_name && s.kind === "purchase"),
  );
  const odin = offers.find((o) => o.slug === "odin");
  if (sold === undefined || odin === undefined)
    throw new Error(
      "fixtures/acquisition needs a ship sold in the game and the Odin",
    );
  const lowest = Math.min(
    ...shops
      .filter((s) => s.class_name === sold.class_name && s.kind === "purchase")
      .map((s) => s.price_auec),
  );
  await page.goto(`/ships/${sold.slug}`);
  const acq = page.locator("#acquisition");
  await expect(acq).toContainText(
    `From ${lowest.toLocaleString("en-US")} aUEC`,
  );
  await expect(
    acq.getByRole("table", { name: /In-game shop terminals/ }),
  ).toBeVisible();
  await expect(acq.getByRole("table", { name: /Pledge store/ })).toBeVisible();
  await expect(acq).toContainText("may not reflect live servers");
  await expect(page.locator("#sources")).toContainText("UEX Corp");
  await expect(page.locator("#sources")).toContainText("RSI pledge store");

  // A concept ship: RSI's own pledge page price, and no shops.
  await page.goto("/ships/odin");
  await expect(page.locator("#acquisition")).toContainText(
    `${odin.price_usd.toLocaleString("en-US")} USD`,
  );
  await expect(page.locator("#acquisition")).toContainText(
    "Not sold or rented in the game",
  );

  // The ships table, compare and the home register show the headline prices, credited.
  await page.goto("/ships?view=table");
  await expect(
    page.getByRole("columnheader", { name: /Pledge/ }),
  ).toBeVisible();
  await expect(page.getByText(/may not reflect live servers/)).toBeVisible();
  await page.goto(`/compare?ships=${sold.slug}`);
  await expect(page.getByRole("main")).toContainText("Pledge status");
  await page.goto("/");
  await expect(page.getByRole("main")).toContainText(
    odin.price_usd.toLocaleString("en-US"),
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

test("the stock loadout by system and the raw port table are each one disclosure away", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  const section = page.locator("#hardpoints");
  await section.getByText("Every fitted part by system").click();
  await expect(
    section.getByRole("heading", { level: 3, name: "Weapons" }),
  ).toBeVisible();
  // A merged entry shows its count, and a mount keeps its own items nested beneath it.
  await expect(section.getByText(/×\d+/).first()).toBeVisible();
  await expect(section.locator("li li").first()).toBeVisible();
  // Every mounted item links to a component page.
  const links = section.getByRole("link");
  expect(await links.count()).toBeGreaterThan(0);
  await expect(links.first()).toHaveAttribute("href", /^\/components\//);
  // The per-port table is collapsed until asked for.
  const table = section.getByRole("table");
  await expect(table).toBeHidden();
  await section.getByText(/^All \d+ ports by game name$/).click();
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Port/ })).toBeVisible();
});

// ADR-016: the loadout editor swaps a part for one that fits, sums the build against stock and
// keeps it in the address.
test("the loadout editor swaps a gun, shows the change against stock and keeps the build in the address", async ({
  page,
}) => {
  await page.goto("/ships/gladius");
  const section = page.locator("#hardpoints");
  await expect(
    section.getByRole("heading", { level: 3, name: "Stock build" }),
  ).toBeVisible();
  const guns = section.getByRole("region", { name: /Guns/ }).or(
    section.locator("section", {
      has: page.getByRole("heading", { level: 3, name: /^Guns/ }),
    }),
  );
  await guns.getByRole("button", { name: "Change" }).first().click();
  const picker = section.getByRole("region", { name: /^Parts that fit/ });
  await expect(picker).toBeVisible();
  // Every part offered is the slot's size.
  const sizes = await picker.locator("tbody tr").allInnerTexts();
  expect(sizes.length).toBeGreaterThan(1);
  for (const row of sizes) expect(row).toContain("S3");
  // Fit the first part that is not fitted now.
  await picker.locator("tbody button:not([disabled])").first().click();
  await expect(picker).toBeHidden();
  await expect(
    section.getByRole("heading", {
      level: 3,
      name: /^Your build: \d+ parts? changed$/,
    }),
  ).toBeVisible();
  await expect(section.getByText(/on stock$/).first()).toBeVisible();
  await expect(page).toHaveURL(/[?&]build=/);
  // The address opens the same build; back to stock clears it.
  await page.reload();
  await expect(
    section.getByRole("heading", { level: 3, name: /^Your build:/ }),
  ).toBeVisible();
  await section.getByRole("button", { name: "Back to stock" }).click();
  await expect(
    section.getByRole("heading", { level: 3, name: "Stock build" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]build=/);
});

test("the armament is drawn by who fires it, every part linked", async ({
  page,
}) => {
  await page.goto("/ships/gladius");
  const combat = page.locator("#combat");
  await expect(
    combat.getByRole("region", { name: "Pilot guns" }),
  ).toBeVisible();
  await expect(
    combat.getByRole("region", { name: "Missile racks" }),
  ).toBeVisible();
  const link = combat
    .getByRole("region", { name: "Pilot guns" })
    .getByRole("link")
    .first();
  await expect(link).toHaveAttribute("href", /^\/components\//);
});

test("a ship file links its related ships: the maker's others and the same role", async ({
  page,
}) => {
  // The Perseus and the Polaris share a maker (RSI) in the pack.
  await page.goto("/ships/perseus");
  const related = page.getByRole("navigation", { name: "Related ships" });
  await expect(related).toBeVisible();
  await expect(related.getByRole("link", { name: "Polaris" })).toHaveAttribute(
    "href",
    "/ships/polaris",
  );
});
