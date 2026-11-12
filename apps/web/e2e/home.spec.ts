import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { eventForFront } from "schema";
import { clock, shows } from "./shows";

// The hero home page (ADR-038): dispatches first, the featured ships with the register's count,
// the developers' latest only with Spectrum on, and this year's funding with its two views. Runs
// over the committed packs; CI has Spectrum off, so the developers' section is checked absent here
// and present in devtracker.spec.ts.

const on = ["poll", "feed"].includes(process.env["SPECTRUM_MODE"] ?? "");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "__screenshots__");
// A show on (ADR-057) puts its hero at the top of the page; outside one, the lead story (ADR-058).
const showOn = eventForFront(shows, clock) !== null;

test("the title is the lead story's, linked to its source, under the date label", async ({
  page,
}) => {
  test.skip(showOn, "a show's hero stands in the lead story's place (ADR-057)");
  await page.goto("/");
  await expect(page.locator("main p.lab").first()).toHaveText(
    /^\w+ \d+ \w+ \d{4} · in the ’verse$/,
  );
  const lead = page.locator("section[aria-labelledby=lead-story]");
  const title = lead.getByRole("heading", { level: 1 });
  await expect(title).toBeVisible();
  const href = await title.getByRole("link").getAttribute("href");
  expect(href).toMatch(
    /^https:\/\/(robertsspaceindustries\.com\/|www\.youtube\.com\/)/,
  );
  // Published before today, so the lead holds for the day; never repeated in the carousel below.
  const published = await lead.locator("time").getAttribute("datetime");
  expect(Date.parse(published ?? "")).toBeLessThan(
    Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()),
  );
  const rail = page.locator("section[aria-labelledby=dispatches]");
  await expect(rail.locator(`a[href="${href}"]`)).toHaveCount(0);
  // The daily line and the contents are gone (ADR-058).
  await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(
    0,
  );
});

test("the sections run dispatches, featured ships, developers (with Spectrum on), funding", async ({
  page,
}) => {
  await page.goto("/");
  const heads = await page.locator("main h2.lab").allTextContents();
  const expected = on
    ? [
        "Dispatches from the Verse",
        "Featured vehicles and ships",
        "Developer gold posts",
        "Funding this year",
      ]
    : [
        "Dispatches from the Verse",
        "Featured vehicles and ships",
        "Funding this year",
      ];
  expect(heads.filter((h) => expected.includes(h))).toEqual(expected);
  // The entries A to Z left the front page.
  expect(heads).not.toContain("Entries, A to Z");
  if (!on) {
    await expect(page.getByText("Developer gold posts")).toHaveCount(0);
  }
});

test("the dispatches come first, five of them in a carousel, each linked to its source, and none from Spectrum", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=dispatches]");
  await expect(section.locator("article")).toHaveCount(5);
  const links = section.getByRole("link", { name: "Read on the source site" });
  await expect(links).toHaveCount(5);
  for (const href of await links.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")),
  )) {
    expect(href).toMatch(/^https:\/\/robertsspaceindustries\.com\//);
    expect(href).not.toMatch(/\/spectrum\//);
  }
  await expect(
    section.getByRole("link", { name: "All dispatches" }),
  ).toHaveAttribute("href", "/news");
  // The dispatches sit above the featured ships.
  const dispatchesTop = await section.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  const featuredTop = await page
    .locator("section[aria-labelledby=featured]")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(dispatchesTop).toBeLessThan(featuredTop);
});

test("the featured ships are five cards with the showcase pair, and the register link carries the pack's count", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=featured]");
  const cards = section.locator("ul li a[href^='/ships/']");
  await expect(cards).toHaveCount(5);
  const hrefs = await cards.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")),
  );
  expect(hrefs[0]).toBe("/ships/perseus");
  expect(hrefs[1]).toBe("/ships/odin");
  expect(new Set(hrefs).size).toBe(5);
  await expect(section.getByText("Changes daily")).toBeVisible();
  // The strip's "Ships on record" figure and the register link agree.
  const onRecord = await page
    .locator("dl div", { hasText: "Ships on record" })
    .locator("dd a")
    .first()
    .textContent();
  const link = section.getByRole("link", { name: /^See all \d+ ships/ });
  await expect(link).toHaveAttribute("href", "/ships");
  await expect(link).toHaveText(
    `See all ${onRecord?.trim()} ships and vehicles in the register`,
  );
});

test("the ledger's old address lands on the home's funding card, which the counters point at, each at its measure (ADR-040)", async ({
  page,
  request,
}) => {
  const response = await request.get("/funding", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toMatch(/\/#funding$/);
  await page.goto("/");
  const pledged = page
    .locator("dl div", { hasText: /^Pledged since/ })
    .locator("dd a")
    .first();
  await expect(pledged).toHaveAttribute("href", "#funding-pledges");
  await expect(page.locator("section[aria-labelledby=funding]")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Funding" }),
  ).toHaveCount(0);
  // The other funding counters point at the card too, Citizens at the card's citizens (ADR-040,
  // amended).
  const thisYear = page.locator("dl div", { hasText: /^This year/ });
  await expect(thisYear.locator("dd a").first()).toHaveAttribute(
    "href",
    "#funding-pledges",
  );
  await expect(
    page
      // The counter reads "Citizens" then its figure; the card's "Citizens gained in …" is not it.
      .locator("dl div", { hasText: /^Citizens\d/ })
      .locator("dd a")
      .first(),
  ).toHaveAttribute("href", "#funding-citizens");
  // The sources line names RSI's page and the copy date.
  const sources = page.locator("section[aria-labelledby=funding] p", {
    hasText: /^Daily snapshots/,
  });
  await expect(
    sources.getByRole("link", { name: "robertsspaceindustries.com" }),
  ).toBeVisible();
  await expect(sources).toContainText(/copied \d+ \w+ \d{4}\./);
  // The old measure address lands on the card's citizens; Next keeps the query, which the home
  // ignores.
  const citizens = await request.get("/funding?measure=citizens", {
    maxRedirects: 0,
  });
  expect(citizens.status()).toBe(308);
  expect(citizens.headers()["location"]).toMatch(/#funding-citizens$/);
});

test("the counters open the funding card on their own measure, with its running head in view (ADR-040, amended)", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=funding]");
  const measure = section.getByRole("group", { name: "Funding measure" });
  const pledgesButton = measure.getByRole("button", { name: "Pledges" });
  const citizensButton = measure.getByRole("button", { name: "Citizens" });
  const counter = (label: RegExp) =>
    page.locator("dl div", { hasText: label }).locator("dd a").first();
  const headTop = () =>
    page
      .locator("#funding")
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
  // The Citizens figure: the card opens on citizens, its head at the top of the screen.
  await counter(/^Citizens\d/).click();
  await expect(page).toHaveURL(/#funding-citizens$/);
  await expect(citizensButton).toHaveAttribute("aria-pressed", "true");
  await expect(section.locator("[data-measure=citizens]")).toBeVisible();
  await expect(section.locator("[data-measure=pledges]")).toBeHidden();
  const top = await headTop();
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(24);
  // Pressing Pledges rewrites the address in place; the Citizens link opens citizens again.
  await pledgesButton.click();
  await expect(page).toHaveURL(/#funding-pledges$/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await counter(/^Citizens\d/).click();
  await expect(citizensButton).toHaveAttribute("aria-pressed", "true");
  // A pledges figure opens the card on pledges.
  await page.evaluate(() => window.scrollTo(0, 0));
  await counter(/^Pledged since/).click();
  await expect(page).toHaveURL(/#funding-pledges$/);
  await expect(pledgesButton).toHaveAttribute("aria-pressed", "true");
  expect(await headTop()).toBeLessThan(24);
  // The address opens the card on citizens from a fresh load too; a bare #funding then leaves the
  // measure as it is.
  await page.goto("about:blank");
  await page.goto("/#funding-citizens");
  await expect(citizensButton).toHaveAttribute("aria-pressed", "true");
  expect(await headTop()).toBeLessThan(24);
  // Waits for the change to be announced and the card to have heard it before looking.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener("hashchange", () => setTimeout(resolve, 200), {
          once: true,
        });
        window.location.hash = "funding";
      }),
  );
  await expect(page).toHaveURL(/#funding$/);
  await expect(citizensButton).toHaveAttribute("aria-pressed", "true");
  // The pledges' address, typed in, opens the pledges.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener("hashchange", () => setTimeout(resolve, 200), {
          once: true,
        });
        window.location.hash = "funding-pledges";
      }),
  );
  await expect(pledgesButton).toHaveAttribute("aria-pressed", "true");
});

test("Back returns to the front page after a counter's link and a page away (ADR-040, amended)", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("dl div", { hasText: /^Citizens\d/ })
    .locator("dd a")
    .first()
    .click();
  await expect(page).toHaveURL(/\/#funding-citizens$/);
  await page
    .locator("section[aria-labelledby=featured] ul li a[href^='/ships/']")
    .first()
    .click();
  await expect(page).toHaveURL(/\/ships\/[a-z0-9-]+$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/#funding-citizens$/);
  // The front page itself, not the ship's page under the old address, with the card on citizens.
  const section = page.locator("section[aria-labelledby=funding]");
  await expect(section).toBeVisible();
  await expect(
    section
      .getByRole("group", { name: "Funding measure" })
      .getByRole("button", { name: "Citizens" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the funding card shows the year's three figures and toggles between the two views", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=funding]");
  // The pledges show first; the citizens' copy of the figures is in the document, hidden.
  const shown = section.locator("[data-measure=pledges]");
  await expect(shown.getByText(/^Pledged in \d{4} so far$/)).toBeVisible();
  await expect(shown.getByText(/^Of \d{4}'s total$/)).toBeVisible();
  await expect(shown.getByText("Year on year")).toBeVisible();
  await expect(section.getByText(/^as of \d+ \w+ \d{4}$/)).toBeVisible();
  await expect(
    section.getByRole("link", { name: "Star Citizen Wiki API" }),
  ).toBeVisible();
  const group = section.getByRole("group", { name: "Funding view" });
  const ytd = group.getByRole("button", { name: "Year to date" });
  const months = group.getByRole("button", { name: "By month" });
  await expect(ytd).toHaveAttribute("aria-pressed", "true");
  await expect(months).toHaveAttribute("aria-pressed", "false");
  // The year-to-date view draws this year against last year (in the first days of a year, before
  // two readings, it is a sentence instead); the month view is in the document but hidden until
  // pressed.
  const ytdView = section.locator("[data-measure=pledges] [id$=-ytd]");
  const monthView = section.locator("[data-measure=pledges] [id$=-months]");
  await expect(ytdView).toBeVisible();
  await expect(monthView).toBeHidden();
  await months.click();
  await expect(months).toHaveAttribute("aria-pressed", "true");
  await expect(ytd).toHaveAttribute("aria-pressed", "false");
  await expect(monthView).toBeVisible();
  await expect(ytdView).toBeHidden();
  // Every month bar carries a title with its figure; the frame's summary names both years.
  const titles = await monthView.locator("svg rect title").allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  for (const t of titles) expect(t).toMatch(/^[A-Z][a-z]{2} \d{4}/);
  await expect(monthView.locator("figcaption")).toContainText(
    /beside the same month of \d{4}/,
  );
});

test("the funding card counts citizens too, keeping the view across a switch (ADR-040, amended)", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=funding]");
  const measure = section.getByRole("group", { name: "Funding measure" });
  const pledgesButton = measure.getByRole("button", { name: "Pledges" });
  const citizensButton = measure.getByRole("button", { name: "Citizens" });
  await expect(pledgesButton).toHaveAttribute("aria-pressed", "true");
  const pledges = section.locator("[data-measure=pledges]");
  const citizens = section.locator("[data-measure=citizens]");
  await expect(pledges).toBeVisible();
  await expect(citizens).toBeHidden();
  // The month view first, then the measure: the citizens open on their months.
  await section.getByRole("button", { name: "By month" }).click();
  await citizensButton.click();
  await expect(citizensButton).toHaveAttribute("aria-pressed", "true");
  await expect(citizens).toBeVisible();
  await expect(pledges).toBeHidden();
  await expect(
    citizens.getByText(/^Citizens gained in \d{4} so far$/),
  ).toBeVisible();
  await expect(citizens.locator("[id$=-months]")).toBeVisible();
  await expect(citizens.locator("[id$=-ytd]")).toBeHidden();
  // Citizens are counted, not paid: no dollar sign anywhere in their view, axes, titles and
  // summaries included (textContent reads the hidden parts too).
  const text = (await citizens.textContent()) ?? "";
  expect(text).not.toContain("$");
  const titles = await citizens
    .locator("[id$=-months] svg rect title")
    .allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  await section.getByRole("button", { name: "Year to date" }).click();
  await expect(citizens.locator("[id$=-ytd]")).toBeVisible();
});

// The "By month" view's record (ADR-038): the funding section with the toggle pressed, at both
// widths and in both schemes, beside the home records that show the year-to-date view.
for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`home-funding-months at ${viewport.width} px, ${scheme}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto("/");
      const section = page.locator("section[aria-labelledby=funding]");
      await section.getByRole("button", { name: "By month" }).click();
      await expect(
        section.locator("[data-measure=pledges] [id$=-months]"),
      ).toBeVisible();
      mkdirSync(OUT, { recursive: true });
      await section.screenshot({
        path: join(OUT, `home-funding-months-${viewport.name}-${scheme}.png`),
      });
      // The citizens' year to date (ADR-040, amended), the card's other measure.
      await section.getByRole("button", { name: "Year to date" }).click();
      await section.getByRole("button", { name: "Citizens" }).click();
      await expect(
        section.locator("[data-measure=citizens] [id$=-ytd]"),
      ).toBeVisible();
      await section.screenshot({
        path: join(OUT, `home-funding-citizens-${viewport.name}-${scheme}.png`),
      });
      await context.close();
    });
  }
}
