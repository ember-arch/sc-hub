import { describe, expect, it } from "vitest";
import {
  offerFromJsonLd,
  offerKind,
  offersFromSkus,
  shopRows,
  storeSection,
} from "../bootstrap-fixtures/acquisition.js";

// ADR-013: shops and prices are copied, never typed in; unknown shapes halt the run.

const AT = "2026-11-08T12:00:00.000Z";
const ship = { slug: "test-ship", class_name: "TEST_Ship" };
const sku = (over: Record<string, unknown> = {}) => ({
  source: "pledge_store",
  cig_id: 1,
  title: "Test Ship",
  url: "https://robertsspaceindustries.com/pledge/Standalone-Ships/Test-Ship",
  price: 90,
  discounted_price: null,
  is_warbond: false,
  is_package: false,
  available: true,
  imported_at: "2026-11-08T00:00:33.000000Z",
  ...over,
});

describe("store sections and kinds", () => {
  it("reads the section from the folder above the item", () => {
    expect(
      storeSection(
        "https://robertsspaceindustries.com/pledge/Standalone-Ships/X",
      ),
    ).toBe("Standalone Ships");
    expect(
      storeSection(
        "https://robertsspaceindustries.com/electronic-access/Ship-Roms/X",
      ),
    ).toBe("Ship Roms");
    expect(
      storeSection("https://robertsspaceindustries.com/pledge"),
    ).toBeNull();
  });

  it("calls a pack a pack whatever its folder, and keeps unknown folders as other", () => {
    expect(
      offerKind({ url: "https://x.test/pledge/Upgrades/A", is_package: false }),
    ).toBe("upgrade");
    expect(
      offerKind({ url: "https://x.test/pledge/Upgrades/A", is_package: true }),
    ).toBe("package");
    expect(
      offerKind({
        url: "https://x.test/electronic-access/Ship-Roms/A",
        is_package: false,
      }),
    ).toBe("other");
  });
});

describe("offersFromSkus", () => {
  it("maps pledge-store rows with their warbond flag, availability and the wiki's read time", () => {
    const { offers, skipped } = offersFromSkus(
      [sku(), sku({ is_warbond: true, available: false, price: 80 })],
      ship,
      AT,
    );
    expect(skipped).toBe(0);
    expect(offers[0]).toMatchObject({
      slug: "test-ship",
      class_name: "TEST_Ship",
      kind: "standalone",
      store_section: "Standalone Ships",
      price_usd: 90,
      warbond: false,
      available: true,
      observed_at: "2026-11-08T00:00:33.000Z",
      via: "star_citizen_wiki_api",
    });
    expect(offers[1]).toMatchObject({
      warbond: true,
      available: false,
      price_usd: 80,
    });
  });

  it("leaves out the stale upgrade_api rows and halts on a source it does not know", () => {
    const stale = {
      source: "upgrade_api",
      title: "Old",
      url: null,
      price: 1,
      is_warbond: null,
    };
    expect(offersFromSkus([sku(), stale], ship, AT).skipped).toBe(1);
    expect(() => offersFromSkus([{ source: "mystery" }], ship, AT)).toThrow(
      /unknown sku source/,
    );
  });

  // Issue 34: the store listed a row at $0 and the whole price refresh halted for days.
  it("leaves out a row the store lists at no price, names it, and still halts on a negative one", () => {
    const { offers, skipped, zeroPriced } = offersFromSkus(
      [sku(), sku({ title: "Free Thing", price: 0 })],
      ship,
      AT,
    );
    expect(offers.map((o) => o.price_usd)).toEqual([90]);
    expect(skipped).toBe(0);
    expect(zeroPriced).toEqual(["Free Thing"]);
    expect(() => offersFromSkus([sku({ price: -5 })], ship, AT)).toThrow();
    expect(() => offersFromSkus([sku({ price: null })], ship, AT)).toThrow();
  });
});

describe("shopRows", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    price_buy: 1000,
    price_rent: null,
    terminal_name: "Shop A - Somewhere",
    starmap_location: {
      name: "Somewhere",
      parent_name: "Planet",
      star_system_name: "System",
    },
    date_updated: "2026-10-17T04:33:29+00:00",
    game_version: "4.10.2-LIVE.1",
    uex_link: "https://uexcorp.space/x",
    ...over,
  });
  const build = { channel: "LIVE", game_version: "4.10.2-LIVE.1" };

  it("keeps the pack's build, counts other builds, and ignores empty prices", () => {
    const { rows, skipped } = shopRows(
      {
        purchase: [
          row(),
          row({ game_version: "4.9.0-LIVE.1" }),
          row({ price_buy: null }),
        ],
        rental: [
          row({ price_buy: null, price_rent: 50, terminal_name: "Rentals B" }),
        ],
      },
      ship,
      build,
      AT,
    );
    expect(skipped).toBe(1);
    expect(rows.map((r) => [r.kind, r.price_auec, r.terminal])).toEqual([
      ["purchase", 1000, "Shop A - Somewhere"],
      ["rental", 50, "Rentals B"],
    ]);
    expect(rows[0]).toMatchObject({
      location: "Somewhere",
      parent: "Planet",
      system: "System",
      reported_at: "2026-10-17T04:33:29.000Z",
      channel: "LIVE",
    });
  });
});

describe("offerFromJsonLd", () => {
  const page = (offers: unknown) =>
    `<html><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Test Ship",
      offers,
    })}</script></html>`;

  it("reads RSI's schema.org offer, out of stock as not on sale", () => {
    expect(
      offerFromJsonLd(
        page({
          "@type": "Offer",
          price: "5900.00",
          priceCurrency: "USD",
          availability: "https://schema.org/OutOfStock",
        }),
      ),
    ).toEqual({ name: "Test Ship", price_usd: 5900, available: false });
  });

  it("returns null without a product and halts on an availability it does not know", () => {
    expect(offerFromJsonLd("<html></html>")).toBeNull();
    expect(() =>
      offerFromJsonLd(
        page({
          "@type": "Offer",
          price: "1",
          priceCurrency: "USD",
          availability: "https://schema.org/Maybe",
        }),
      ),
    ).toThrow(/availability/);
  });
});
