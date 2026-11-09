import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";
import { listedVehicles } from "../lib/editions";

// Spec 02, criterion "SEO": server-rendered pages, canonical URLs, per-page title and
// description, sitemap.xml, JSON-LD for ships and manufacturers, and an Open Graph image per
// ship. Expected entities are read from the fixture pack. The public origin is whatever
// SITE_URL the server was started with; locally that is the dev origin.

interface Row {
  slug: string;
  name: string;
}
interface VehicleRow extends Row {
  class_name: string;
  manufacturer_code: string;
  base_variant_of: string | null;
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
// Entries only: an edition's canonical link points at its base and the sitemap lists entries.
const vehicles = listedVehicles(fixture<VehicleRow[]>("Vehicle.json"));
const items = fixture<Row[]>("Item.json");
const manufacturers = fixture<Row[]>("Manufacturer.json");
const ship = vehicles[0];
const maker = manufacturers[0];
if (ship === undefined || maker === undefined) throw new Error("empty pack");

const canonicalOf = async (page: Page): Promise<string | null> =>
  page.locator('link[rel="canonical"]').getAttribute("href");

test("every page kind carries a canonical URL, a title and a description", async ({
  page,
}) => {
  const cases: readonly [string, string, RegExp][] = [
    ["/", "/", /SC Hub/],
    ["/ships?size=small&view=table", "/ships", /^Ships — /],
    [`/ships/${ship.slug}`, `/ships/${ship.slug}`, new RegExp(ship.name)],
    ["/components?size=1", "/components", /^Components — /],
    [
      `/manufacturers/${maker.slug}`,
      `/manufacturers/${maker.slug}`,
      new RegExp(maker.name),
    ],
    [`/compare?ships=${ship.slug}`, "/compare", /^Compare ships — /],
    ["/news", "/news", /^News — /],
    ["/about", "/about", /^About — /],
  ];
  for (const [path, canonicalPath, title] of cases) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const canonical = await canonicalOf(page);
    expect(canonical, `${path} canonical`).not.toBeNull();
    expect(new URL(canonical ?? "").pathname, `${path} canonical path`).toBe(
      canonicalPath,
    );
    await expect(page).toHaveTitle(title);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description, `${path} description`).toBeTruthy();
  }
  // Compare permutations are shareable but not for indexing.
  await page.goto(`/compare?ships=${ship.slug}`);
  const robots = await page
    .locator('meta[name="robots"]')
    .getAttribute("content");
  expect(robots).toMatch(/noindex/);
});

test("sitemap.xml lists every ship, component and manufacturer page and robots.txt points at it", async ({
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toMatch(/xml/);
  const xml = await sitemap.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1] ?? "").pathname,
  );
  for (const v of vehicles) expect(locs).toContain(`/ships/${v.slug}`);
  for (const i of items) expect(locs).toContain(`/components/${i.slug}`);
  for (const m of manufacturers)
    expect(locs).toContain(`/manufacturers/${m.slug}`);
  for (const path of ["/", "/ships", "/components", "/news", "/about"])
    expect(locs).toContain(path);
  expect(locs.some((p) => p.startsWith("/compare"))).toBe(false);
  expect(locs.some((p) => p.startsWith("/gallery"))).toBe(false);
  expect(new Set(locs).size).toBe(locs.length);

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  expect(text).toMatch(/Disallow: \/gallery/);
  // Compare carries noindex, which a crawler only sees if robots.txt lets it fetch the page.
  expect(text).not.toMatch(/Disallow: \/compare/);
  expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("ship and manufacturer pages carry valid JSON-LD with the page's own facts", async ({
  page,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  const shipLd = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? "null",
  ) as Record<string, unknown>;
  expect(shipLd["@context"]).toBe("https://schema.org");
  expect(shipLd["@type"]).toBe("Vehicle");
  expect(shipLd["name"]).toBe(ship.name);
  expect(new URL(String(shipLd["url"])).pathname).toBe(`/ships/${ship.slug}`);
  expect(shipLd["manufacturer"]).toMatchObject({ "@type": "Organization" });

  await page.goto(`/manufacturers/${maker.slug}`);
  const makerLd = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? "null",
  ) as Record<string, unknown>;
  expect(makerLd["@type"]).toBe("Organization");
  expect(makerLd["name"]).toBe(maker.name);
  expect(new URL(String(makerLd["url"])).pathname).toBe(
    `/manufacturers/${maker.slug}`,
  );
});

test("each ship has an Open Graph image and the page points at it", async ({
  page,
  request,
}) => {
  await page.goto(`/ships/${ship.slug}`);
  const og = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute("content");
  expect(og).not.toBeNull();
  const url = new URL(og ?? "");
  expect(url.pathname).toMatch(
    new RegExp(`^/ships/${ship.slug}/opengraph-image`),
  );
  const image = await request.get(url.pathname + url.search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  const bytes = await image.body();
  // PNG signature, then the IHDR width and height (big-endian) at bytes 16 to 23.
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  // Kept with the page screenshots so the PR shows the card (CLAUDE.md section 8).
  const out = join(dirname(fileURLToPath(import.meta.url)), "__screenshots__");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "og-ship.png"), bytes);
});

test("an unknown ship slug is a 404 that still has the search box", async ({
  page,
}) => {
  const response = await page.goto("/ships/no-such-ship");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("button", { name: /Search ships/ }),
  ).toBeVisible();
});
