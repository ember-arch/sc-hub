/**
 * Shops and prices for the ship file (ADR-013), written to `fixtures/acquisition/`.
 *
 * - Ships in the pack: the Star Citizen Wiki API's vehicle record, which relays RSI's pledge store
 *   (`skus`) and UEX Corp's community-reported shop terminal prices (`uex_prices`). One request per
 *   ship through the bootstrap's polite client. A record for another game version than the pack
 *   halts the run; UEX rows reported for another game version are left out and counted.
 * - Concept ships (`fixtures/ship-matrix/ConceptShip.json`): RSI's own schema.org Offer in the
 *   JSON-LD of the ship's pledge page, one request per ship, five seconds apart (CLAUDE.md
 *   section 9).
 *
 * Nothing is converted, defaulted or typed in. Pledge-store rows listed at no price are left out
 * and named in the log (issue 34). An unknown shape halts the run and nothing is written.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/acquisition.ts
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConceptShip, PledgeOffer, ShopPrice } from "schema";
import { z } from "zod";
import { createWikiClient } from "./fetch.js";
import { rsiUserAgent, userAgent } from "../user-agent.js";
import { rsiGet } from "../rsi-fetch.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const packDir = join(repoRoot, "fixtures", "bootstrap");
const conceptFile = join(
  repoRoot,
  "fixtures",
  "ship-matrix",
  "ConceptShip.json",
);
const outDir = join(repoRoot, "fixtures", "acquisition");

const USER_AGENT = userAgent("bootstrap");
const RSI_SPACING_MS = 5_000;

const Sku = z
  .object({
    source: z.literal("pledge_store"),
    title: z.string().min(1),
    url: z.url(),
    price: z.number().positive(),
    discounted_price: z.number().positive().nullable(),
    is_warbond: z.boolean(),
    is_package: z.boolean(),
    available: z.boolean(),
    imported_at: z.string(),
  })
  .loose();

/**
 * The wiki also relays `upgrade_api` rows: upgrade listings last seen in 2024 and 2025, without a
 * store link, some still marked available. They are left out and counted (ADR-013); a source the
 * code does not know halts the run.
 */
const SKIPPED_SKU_SOURCES: ReadonlySet<string> = new Set(["upgrade_api"]);

/**
 * A pledge-store row the store lists at no price: nothing a backer pays for, so not an offer to
 * show beside the ship's prices. Its shape is checked like any other row; it is left out, counted
 * and named in the run summary (issue 34). Any other price that is not a positive number halts.
 */
const ZeroPriced = Sku.extend({ price: z.literal(0) });
const AnySku = z.object({ source: z.string() }).loose();
export type Sku = z.infer<typeof Sku>;

const UexRow = z
  .object({
    price_buy: z.number().nullable().optional(),
    price_rent: z.number().nullable().optional(),
    terminal_name: z.string().min(1),
    starmap_location: z
      .object({
        name: z.string().nullable().optional(),
        parent_name: z.string().nullable().optional(),
        star_system_name: z.string().nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
    date_updated: z.string(),
    game_version: z.string().min(1),
    uex_link: z.url().nullable().optional(),
  })
  .loose();
export type UexRow = z.infer<typeof UexRow>;

const WikiVehicle = z.object({
  data: z.object({
    class_name: z.string(),
    version: z.string(),
    skus: z.array(AnySku).nullable().optional(),
    uex_prices: z
      .object({ purchase: z.array(UexRow), rental: z.array(UexRow) })
      .nullable()
      .optional(),
  }),
});

const Manifest = z.object({ channel: z.string(), game_version: z.string() });
const StatsRow = z.object({
  class_name: z.string(),
  raw: z.object({ uuid: z.string() }).loose(),
});
const VehicleRow = z
  .object({ class_name: z.string(), slug: z.string() })
  .loose();

const iso = (value: string): string => {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`not a timestamp: ${value}`);
  return new Date(ms).toISOString();
};

/** "/pledge/Standalone-Ships/Gladius" gives "Standalone Ships": the folder above the item. */
export function storeSection(url: string): string | null {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const section = parts.length >= 3 ? parts.at(-2) : undefined;
  return section === undefined ? null : section.replace(/-/g, " ");
}

export function offerKind(
  sku: Pick<Sku, "url" | "is_package">,
): PledgeOffer["kind"] {
  if (sku.is_package) return "package";
  const section = storeSection(sku.url);
  if (section === "Standalone Ships") return "standalone";
  if (section === "Upgrades") return "upgrade";
  return "other";
}

/** The wiki's pledge-store rows for one ship; known stale sources are counted, unknown ones halt. */
export function offersFromSkus(
  skus: readonly { readonly source: string }[],
  ship: { slug: string; class_name: string },
  fetchedAt: string,
): { offers: PledgeOffer[]; skipped: number; zeroPriced: string[] } {
  const zeroPriced: string[] = [];
  const kept = skus.filter((row) => {
    if (SKIPPED_SKU_SOURCES.has(row.source)) return false;
    if (row.source !== "pledge_store") {
      throw new Error(`${ship.class_name}: unknown sku source "${row.source}"`);
    }
    const free = ZeroPriced.safeParse(row);
    if (free.success) {
      zeroPriced.push(free.data.title);
      return false;
    }
    return true;
  });
  const offers = kept.map((row) => {
    const sku = Sku.parse(row);
    return PledgeOffer.parse({
      slug: ship.slug,
      class_name: ship.class_name,
      title: sku.title,
      kind: offerKind(sku),
      store_section: storeSection(sku.url),
      price_usd: sku.price,
      discounted_price_usd: sku.discounted_price,
      warbond: sku.is_warbond,
      available: sku.available,
      url: sku.url,
      observed_at: iso(sku.imported_at),
      via: "star_citizen_wiki_api",
      fetched_at: fetchedAt,
    });
  });
  return {
    offers,
    skipped: skus.length - kept.length - zeroPriced.length,
    zeroPriced,
  };
}

/** UEX rows for the pack's build; rows reported for another build are returned as `skipped`. */
export function shopRows(
  prices: { purchase: readonly UexRow[]; rental: readonly UexRow[] },
  ship: { class_name: string },
  build: { channel: string; game_version: string },
  fetchedAt: string,
): { rows: ShopPrice[]; skipped: number } {
  const rows: ShopPrice[] = [];
  let skipped = 0;
  const add = (
    row: UexRow,
    kind: ShopPrice["kind"],
    price: number | null | undefined,
  ) => {
    if (price === null || price === undefined || price <= 0) return;
    if (row.game_version !== build.game_version) {
      skipped += 1;
      return;
    }
    rows.push(
      ShopPrice.parse({
        class_name: ship.class_name,
        channel: build.channel,
        game_version: row.game_version,
        kind,
        price_auec: price,
        terminal: row.terminal_name,
        location: row.starmap_location?.name ?? null,
        parent: row.starmap_location?.parent_name ?? null,
        system: row.starmap_location?.star_system_name ?? null,
        reported_at: iso(row.date_updated),
        source_url: row.uex_link ?? null,
        via: "star_citizen_wiki_api",
        fetched_at: fetchedAt,
      }),
    );
  };
  for (const row of prices.purchase) add(row, "purchase", row.price_buy);
  for (const row of prices.rental) add(row, "rental", row.price_rent);
  return { rows, skipped };
}

const AVAILABILITY: Readonly<Record<string, boolean>> = {
  InStock: true,
  OnlineOnly: true,
  LimitedAvailability: true,
  PreOrder: true,
  PreSale: true,
  OutOfStock: false,
  SoldOut: false,
  Discontinued: false,
};

const LdOffer = z
  .object({
    "@type": z.literal("Offer"),
    price: z.union([z.string(), z.number()]),
    priceCurrency: z.literal("USD"),
    availability: z.string(),
  })
  .loose();

const LdPrice = z.union([z.string(), z.number()]);

/**
 * Several offers for one ship: during a sale (IAE 2956, 13 November 2026) RSI lists the
 * standalone ship and its upgrade together. The ship's price is the aggregate's MSRP, or its one
 * price when the lowest and highest agree; anything else halts.
 */
const LdAggregateOffer = z
  .object({
    "@type": z.literal("AggregateOffer"),
    priceCurrency: z.literal("USD"),
    availability: z.string(),
    lowPrice: LdPrice.optional(),
    highPrice: LdPrice.optional(),
    priceSpecification: z
      .object({
        priceType: z.string().optional(),
        price: LdPrice,
        priceCurrency: z.literal("USD"),
      })
      .loose()
      .optional(),
  })
  .loose();

function priceOf(offers: unknown): { price: unknown; availability: string } {
  const type = (offers as { "@type"?: unknown } | null)?.["@type"];
  if (type !== "AggregateOffer") {
    const offer = LdOffer.parse(offers);
    return { price: offer.price, availability: offer.availability };
  }
  const agg = LdAggregateOffer.parse(offers);
  const spec = agg.priceSpecification;
  const msrp =
    spec !== undefined && (spec.priceType ?? "").endsWith("/MSRP")
      ? spec.price
      : undefined;
  const one =
    agg.lowPrice !== undefined &&
    agg.highPrice !== undefined &&
    Number(agg.lowPrice) === Number(agg.highPrice)
      ? agg.lowPrice
      : undefined;
  const price = msrp ?? one;
  if (price === undefined)
    throw new Error(
      `an AggregateOffer with no MSRP and prices from ${String(agg.lowPrice)} to ${String(agg.highPrice)}`,
    );
  return { price, availability: agg.availability };
}

/**
 * The schema.org Offer RSI embeds in a pledge page's JSON-LD. Returns null when the page carries
 * no Product; throws on an offer shape or availability this code does not know.
 */
export function offerFromJsonLd(
  html: string,
): { name: string | null; price_usd: number; available: boolean } | null {
  const blocks = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    const parsed: unknown = JSON.parse(block[1] ?? "null");
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (typeof node !== "object" || node === null) continue;
      const record = node as Record<string, unknown>;
      if (record["@type"] !== "Product" || record["offers"] === undefined)
        continue;
      const offer = priceOf(record["offers"]);
      const state = offer.availability.replace(/^https?:\/\/schema\.org\//, "");
      const available = AVAILABILITY[state];
      if (available === undefined) {
        throw new Error(
          `unknown schema.org availability "${offer.availability}"`,
        );
      }
      const price = Number(offer.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`not a price: ${String(offer.price)}`);
      }
      return {
        name: typeof record["name"] === "string" ? record["name"] : null,
        price_usd: price,
        available,
      };
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function conceptOffers(fetchedAt: string): Promise<PledgeOffer[]> {
  const concepts = z
    .array(ConceptShip)
    .parse(JSON.parse(readFileSync(conceptFile, "utf8")));
  const out: PledgeOffer[] = [];
  for (const [i, concept] of concepts.entries()) {
    if (i > 0) await sleep(RSI_SPACING_MS);
    // RSI redirects the matrix's old addresses to /en/...: follow only after the spacing.
    const response = await rsiGet(
      concept.page_url,
      { headers: { "User-Agent": rsiUserAgent("bootstrap") } },
      { spacingMs: RSI_SPACING_MS, sleep },
    );
    if (!response.ok) {
      throw new Error(`${concept.page_url}: HTTP ${response.status}`);
    }
    const offer = offerFromJsonLd(await response.text());
    if (offer === null) {
      console.error(
        JSON.stringify({ event: "acquisition.no_offer", slug: concept.slug }),
      );
      continue;
    }
    if (offer.name !== null && !offer.name.includes(concept.name)) {
      throw new Error(
        `${concept.page_url} offers "${offer.name}", expected ${concept.name}`,
      );
    }
    out.push(
      PledgeOffer.parse({
        slug: concept.slug,
        class_name: null,
        title: offer.name ?? concept.name,
        kind: "standalone",
        store_section: null,
        price_usd: offer.price_usd,
        discounted_price_usd: null,
        warbond: null,
        available: offer.available,
        url: concept.page_url,
        observed_at: fetchedAt,
        via: "rsi_pledge_page",
        fetched_at: fetchedAt,
      }),
    );
  }
  return out;
}

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(packDir, file), "utf8"));

async function main(): Promise<void> {
  const runId = randomUUID();
  const manifest = Manifest.parse(readJson("manifest.json"));
  const stats = z.array(StatsRow).parse(readJson("VehicleStats.json"));
  const slugs = new Map(
    z
      .array(VehicleRow)
      .parse(readJson("Vehicle.json"))
      .map((v) => [v.class_name, v.slug]),
  );
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
  });
  const fetchedAt = new Date().toISOString();
  const offers: PledgeOffer[] = [];
  const shops: ShopPrice[] = [];
  let skipped = 0;
  let staleSkus = 0;
  const zeroPriced: string[] = [];
  for (const row of [...stats].sort((a, b) =>
    a.class_name.localeCompare(b.class_name),
  )) {
    const slug = slugs.get(row.class_name);
    if (slug === undefined)
      throw new Error(`${row.class_name}: no slug in Vehicle.json`);
    const json = WikiVehicle.parse(
      await client.getJson(`/api/vehicles/${encodeURIComponent(row.raw.uuid)}`),
    ).data;
    if (json.class_name !== row.class_name) {
      throw new Error(
        `wiki uuid ${row.raw.uuid} is ${json.class_name}, the pack says ${row.class_name}`,
      );
    }
    if (json.version !== manifest.game_version) {
      throw new Error(
        `${row.class_name}: the API serves ${json.version}, the pack is ${manifest.game_version}; regenerate the pack first`,
      );
    }
    const ship = { slug, class_name: row.class_name };
    const own = offersFromSkus(json.skus ?? [], ship, fetchedAt);
    const prices = shopRows(
      json.uex_prices ?? { purchase: [], rental: [] },
      ship,
      manifest,
      fetchedAt,
    );
    offers.push(...own.offers);
    shops.push(...prices.rows);
    skipped += prices.skipped;
    staleSkus += own.skipped;
    zeroPriced.push(
      ...own.zeroPriced.map((title) => `${row.class_name}: ${title}`),
    );
    console.log(
      JSON.stringify({
        event: "acquisition.ship",
        class_name: row.class_name,
        offers: own.offers.length,
        skipped_upgrade_api: own.skipped,
        ...(own.zeroPriced.length > 0
          ? { skipped_zero_price: own.zeroPriced.length }
          : {}),
        purchase: prices.rows.filter((r) => r.kind === "purchase").length,
        rental: prices.rows.filter((r) => r.kind === "rental").length,
        skipped_other_version: prices.skipped,
      }),
    );
  }
  offers.push(...(await conceptOffers(fetchedAt)));
  offers.sort(
    (a, b) =>
      a.slug.localeCompare(b.slug) ||
      a.kind.localeCompare(b.kind) ||
      a.price_usd - b.price_usd ||
      a.title.localeCompare(b.title),
  );
  shops.sort(
    (a, b) =>
      a.class_name.localeCompare(b.class_name) ||
      a.kind.localeCompare(b.kind) ||
      a.price_auec - b.price_auec ||
      a.terminal.localeCompare(b.terminal),
  );
  mkdirSync(outDir, { recursive: true });
  const write = (file: string, rows: unknown[]) =>
    writeFileSync(
      join(outDir, file),
      `${JSON.stringify(rows, null, 2)}\n`,
      "utf8",
    );
  write("PledgeOffer.json", offers);
  write("ShopPrice.json", shops);
  // The summary goes to stderr, which the daily refresh keeps for its report (CLAUDE.md section 6).
  process.stderr.write(
    `${JSON.stringify({
      run_id: runId,
      event: "acquisition.done",
      offers: offers.length,
      shop_prices: shops.length,
      skipped_upgrade_api: staleSkus,
      skipped_zero_price: zeroPriced.length,
      zero_price_titles: zeroPriced,
      skipped_other_version: skipped,
      requests: client.requests,
    })}
`,
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
