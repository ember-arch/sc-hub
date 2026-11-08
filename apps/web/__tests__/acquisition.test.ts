import type { PledgeOffer, ShopPrice } from "schema";
import { describe, expect, it } from "vitest";
import {
  acquisitionFor,
  loanerRowFor,
  loanerValue,
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

describe("loaners from RSI's matrix (ADR-015)", () => {
  const rows = [
    {
      ships: "Carrack w/ C8X / Carrack Expedition w/C8X",
      loaners: ["C8X Pisces Expedition", "URSA Rover"],
    },
    {
      ships: "Carrack / Carrack Expedition",
      loaners: ["C8 Pisces", "URSA Rover"],
    },
    { ships: "Fury Variants", loaners: ["Mustang Alpha"] },
    { ships: "600i Explorer and Executive", loaners: ["Cyclone"] },
    { ships: "Odin", loaners: ["Idris-P"] },
  ];

  it("matches a ship named in a row, not a row that only mentions it", () => {
    expect(loanerRowFor("Carrack", rows)?.loaners).toEqual([
      "C8 Pisces",
      "URSA Rover",
    ]);
    expect(loanerRowFor("Odin", rows)?.loaners).toEqual(["Idris-P"]);
    expect(loanerRowFor("Carrack Expedition", rows)?.ships).toBe(
      "Carrack / Carrack Expedition",
    );
  });

  it("matches a ship through its family row", () => {
    expect(loanerRowFor("Fury", rows)?.loaners).toEqual(["Mustang Alpha"]);
  });

  it("finds nothing for a ship the matrix does not list", () => {
    expect(loanerRowFor("Perseus", rows)).toBeNull();
    expect(loanerRowFor("Gladius", rows)).toBeNull();
  });

  it("says what the matrix says, with its date", () => {
    const view = {
      loaners: ["Idris-P"],
      listedAs: "Odin",
      editedOn: "2026-08-26",
      build: "4.10.0-live.12519617",
      url: "https://support.robertsspaceindustries.com/",
    };
    expect(loanerValue(view, false)).toBe(
      "Idris-P, per RSI's loaner matrix (2026-08-26)",
    );
    expect(loanerValue({ ...view, loaners: [], listedAs: null }, true)).toBe(
      "None; flight ready, not on RSI's loaner matrix (2026-08-26)",
    );
    expect(loanerValue(null, true)).toBe("Not on file");
  });
});
