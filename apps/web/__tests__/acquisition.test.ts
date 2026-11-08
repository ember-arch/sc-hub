import type { PledgeOffer, ShopPrice } from "schema";
import { describe, expect, it } from "vitest";
import {
  acquisitionFor,
  lowestShopPrice,
  pledgeValue,
  shopRows,
} from "../lib/acquisition";
import { insuranceOf } from "../lib/ship-file";

// ADR-013: the ship file's shops and prices, from fixtures/acquisition/.

const offer = (over: Partial<PledgeOffer> = {}): PledgeOffer => ({
  slug: "test-ship",
  class_name: "TEST_Ship",
  title: "Test Ship",
  kind: "standalone",
  store_section: "Standalone Ships",
  price_usd: 100,
  discounted_price_usd: null,
  warbond: false,
  available: false,
  url: "https://robertsspaceindustries.com/pledge/Standalone-Ships/Test",
  observed_at: "2026-09-01T00:00:00.000Z",
  via: "star_citizen_wiki_api",
  fetched_at: "2026-11-08T00:00:00.000Z",
  ...over,
});

const price = (over: Partial<ShopPrice> = {}): ShopPrice => ({
  class_name: "TEST_Ship",
  channel: "LIVE",
  game_version: "4.10.2-LIVE.1",
  kind: "purchase",
  price_auec: 1000,
  terminal: "Shop A",
  location: "Town",
  parent: "Planet",
  system: "System",
  reported_at: "2026-10-01T00:00:00.000Z",
  source_url: "https://uexcorp.space/a",
  via: "star_citizen_wiki_api",
  fetched_at: "2026-11-08T00:00:00.000Z",
  ...over,
});

describe("pledgeValue", () => {
  it("prefers the lowest standalone on sale and ignores warbond editions", () => {
    expect(
      pledgeValue([
        offer({ price_usd: 120, available: true }),
        offer({ price_usd: 90, available: true, warbond: true }),
        offer({ price_usd: 110, available: true }),
      ]),
    ).toMatchObject({ price_usd: 110, available: true });
  });

  it("falls back to the most recently listed standalone when none is on sale", () => {
    expect(
      pledgeValue([
        offer({ price_usd: 700, observed_at: "2026-07-01T00:00:00.000Z" }),
        offer({ price_usd: 800, observed_at: "2026-09-03T00:00:00.000Z" }),
        offer({ kind: "upgrade", price_usd: 1, available: true }),
      ]),
    ).toMatchObject({ price_usd: 800, available: false });
    expect(pledgeValue([offer({ kind: "package" })])).toBeNull();
  });
});

describe("shop prices", () => {
  const shops = [
    price({ price_auec: 2000, terminal: "Shop B" }),
    price({ price_auec: 1500 }),
    price({
      kind: "rental",
      price_auec: 50,
      terminal: "Shop B",
      reported_at: "2026-10-20T00:00:00.000Z",
    }),
  ];

  it("finds the lowest price and counts the terminals reporting one", () => {
    expect(lowestShopPrice(shops, "purchase")).toEqual({
      price_auec: 1500,
      terminals: 2,
      terminal: "Shop A",
    });
    expect(lowestShopPrice([], "rental")).toBeNull();
  });

  it("puts a terminal's purchase and rental prices on one row, with the later report date", () => {
    const rows = shopRows(shops);
    expect(rows.find((r) => r.terminal === "Shop B")).toMatchObject({
      buy_auec: 2000,
      rent_auec: 50,
      place: "Town, Planet",
      reported_at: "2026-10-20T00:00:00.000Z",
    });
    expect(rows.find((r) => r.terminal === "Shop A")).toMatchObject({
      buy_auec: 1500,
      rent_auec: null,
    });
  });
});

describe("the committed fixture", () => {
  it("validates, and carries the Gladius's store rows and the Odin's pledge page offer", () => {
    expect(
      acquisitionFor("gladius", "AEGS_Gladius").offers.length,
    ).toBeGreaterThan(0);
    const odin = acquisitionFor("odin", null);
    expect(odin.offers.map((o) => o.via)).toEqual(["rsi_pledge_page"]);
    expect(odin.shops).toEqual([]);
  });
});

describe("insuranceOf", () => {
  it("reads the three insurance numbers or returns null", () => {
    expect(
      insuranceOf({
        insurance: {
          claim_time: 5.83,
          expedite_time: 1.94,
          expedite_cost: 2335,
        },
      }),
    ).toEqual({ claim_min: 5.83, expedite_min: 1.94, expedite_auec: 2335 });
    expect(insuranceOf({ insurance: { claim_time: 5.83 } })).toBeNull();
    expect(insuranceOf(null)).toBeNull();
  });
});
