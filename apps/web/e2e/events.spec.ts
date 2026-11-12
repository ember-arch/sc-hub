import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { eventForFront, eventShortTitle as shortTitle } from "schema";
import { clock, shows } from "./shows";

// The events module (ADR-057): the event page in the canonical format, the index, and the front
// page's hero, which shows only while a show runs. The page is prerendered with the build's clock;
// a local run pins it with SITE_CLOCK, and this file reads the same clock.

const event = shows.find((e) => e.slug === "iae-2956");
if (event === undefined) throw new Error("fixtures/events has no iae-2956");
const path = `/events/${event.slug}`;
const shipLines = event.days.reduce((n, d) => n + d.ships.length, 0);

test("the event page opens on the show, its days, its schedule and its sources", async ({
  page,
}) => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(event.title);
  const strip = page.getByRole("navigation", { name: "Days of the show" });
  await expect(strip.getByRole("link")).toHaveCount(event.days.length);
  const schedule = page.locator("section[aria-labelledby=schedule]");
  await expect(schedule.locator("article")).toHaveCount(event.days.length);
  // Every chip lands on its own day's section.
  for (const href of await strip
    .getByRole("link")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))) {
    const id = href.split("#")[1] ?? "";
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  }
  // Every ship on the schedule is listed; nearly all link to their entry here, and one the
  // register lacks yet (a reveal of the day) to its RSI page.
  await expect(schedule.locator("article li")).toHaveCount(shipLines);
  const hrefs = await schedule
    .locator("article li a")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  const internal = hrefs.filter((h) => /^\/ships\/[a-z0-9-]+$/.test(h));
  expect(internal.length).toBeGreaterThanOrEqual(Math.floor(shipLines * 0.9));
  for (const href of hrefs) {
    expect(href).toMatch(
      /^(\/ships\/[a-z0-9-]+|https:\/\/robertsspaceindustries\.com\/.+)$/,
    );
  }
  // RSI's words are quoted and linked to the schedule they come from.
  const schedulePage = event.sources.find((s) => s.kind === "comm_link")!;
  await expect(
    page.locator(`blockquote[cite="${schedulePage.url}"]`).first(),
  ).toBeVisible();
  await expect(
    page
      .locator("section[aria-labelledby=sources]")
      .getByRole("link", { name: schedulePage.title }),
  ).toHaveAttribute("href", schedulePage.url);
});

test("a day's chip moves to its section and Back returns to the top", async ({
  page,
}) => {
  await page.goto(path);
  const strip = page.getByRole("navigation", { name: "Days of the show" });
  await strip.getByRole("link").nth(4).click();
  await expect(page).toHaveURL(/#day-5$/);
  await expect(page.locator("#day-5")).toBeInViewport();
  await page.goBack();
  await expect(page).not.toHaveURL(/#day-5$/);
});

test("the events index lists every show into its page", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Events");
  for (const e of shows) {
    await expect(
      page.locator(`a[href="/events/${e.slug}"]`).first(),
    ).toBeVisible();
  }
});

test("the front page carries a show only while it runs", async ({ page }) => {
  const live = eventForFront(shows, clock);
  await page.goto("/");
  const strip = page.getByRole("navigation", { name: "Days of the show" });
  if (live === null) {
    await expect(strip).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /^Everything about / }),
    ).toHaveCount(0);
    return;
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    shortTitle(live),
  );
  await expect(
    page.getByRole("link", { name: `Everything about ${shortTitle(live)}` }),
  ).toHaveAttribute("href", `/events/${live.slug}`);
  await expect(strip.getByRole("link")).toHaveCount(live.days.length);
  // The hero stands where the daily line and the contents were.
  await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(
    0,
  );
});

// The sale comes from a Spectrum post, so it shows only with the module on (ADR-027, ADR-057).
// Its records come from a local run with Spectrum on, like the tracker's.
const spectrum = ["poll", "feed"].includes(process.env["SPECTRUM_MODE"] ?? "");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "__screenshots__");

test("the limited sales show only with Spectrum on, linked to the FAQ they come from", async ({
  page,
}) => {
  await page.goto(path);
  const section = page.locator("section[aria-labelledby=limited]");
  if (!spectrum || event.sales === null) {
    await expect(section).toHaveCount(0);
    return;
  }
  await expect(
    section.getByRole("link", { name: "RSI's FAQ on Spectrum" }),
  ).toHaveAttribute("href", event.sales.source.url);
  await expect(
    section.locator("figure ol > li:not([aria-hidden])"),
  ).toHaveCount(event.sales.waves.length);
  for (const hull of event.sales.hulls) {
    await expect(section.getByText(hull.name, { exact: true })).toBeVisible();
  }
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`event-limited at ${viewport.width} px, ${scheme}`, async ({
      browser,
    }) => {
      test.skip(!spectrum, "the sale shows only with Spectrum on");
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto(path);
      mkdirSync(OUT, { recursive: true });
      await page.locator("section[aria-labelledby=limited]").screenshot({
        path: join(OUT, `event-limited-${viewport.name}-${scheme}.png`),
      });
      await context.close();
    });
  }
}
