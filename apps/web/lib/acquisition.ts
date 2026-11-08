import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PledgeOffer, ShipLoaner, ShopPrice } from "schema";
import { REPO_ROOT } from "./data";

/**
 * Shops and prices for the ship file (ADR-013): RSI pledge-store offers, UEX Corp's
 * community-reported shop prices and the loaners the wiki lists, all copied by
 * scripts/bootstrap-fixtures/acquisition.ts into fixtures/acquisition/. Optional like the other
 * side fixtures: without them the Acquisition section says the prices are not on file.
 */

const OFFERS_FILE = join(
  REPO_ROOT,
  "fixtures",
  "acquisition",
  "PledgeOffer.json",
);
const SHOPS_FILE = join(REPO_ROOT, "fixtures", "acquisition", "ShopPrice.json");
const LOANERS_FILE = join(
  REPO_ROOT,
  "fixtures",
  "acquisition",
  "ShipLoaner.json",
);

const read = (file: string): unknown =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];

export interface Acquisition {
  readonly offers: readonly PledgeOffer[];
  readonly shops: readonly ShopPrice[];
  readonly loaners: readonly ShipLoaner[];
}

let all: Acquisition | undefined;

function load(): Acquisition {
  all ??= {
    offers: PledgeOffer.array().parse(read(OFFERS_FILE)),
    shops: ShopPrice.array().parse(read(SHOPS_FILE)),
    loaners: ShipLoaner.array().parse(read(LOANERS_FILE)),
  };
  return all;
}

/** A ship's rows: offers by slug (concept ships have no class name), the rest by class name. */
export function acquisitionFor(
  slug: string,
  className: string | null,
): Acquisition {
  const a = load();
  return {
    offers: a.offers.filter((o) => o.slug === slug),
    shops:
      className === null
        ? []
        : a.shops.filter((s) => s.class_name === className),
    loaners:
      className === null
        ? []
        : a.loaners.filter((l) => l.class_name === className),
  };
}

export interface PledgeValue {
  readonly price_usd: number;
  readonly available: boolean;
  readonly observed_at: string;
}

/**
 * The ship's standalone pledge price, warbond editions aside: the lowest one on sale, or when none
 * is on sale the most recently listed one. Null when the store never listed it standalone.
 */
export function pledgeValue(
  offers: readonly PledgeOffer[],
): PledgeValue | null {
  const standalone = offers.filter(
    (o) => o.kind === "standalone" && o.warbond !== true,
  );
  const onSale = standalone
    .filter((o) => o.available)
    .sort((a, b) => a.price_usd - b.price_usd);
  const pick =
    onSale[0] ??
    [...standalone].sort((a, b) =>
      b.observed_at.localeCompare(a.observed_at),
    )[0];
  return pick === undefined
    ? null
    : {
        price_usd: pick.price_usd,
        available: pick.available,
        observed_at: pick.observed_at,
      };
}

/** The lowest reported price and how many terminals report one, or null when none does. */
export function lowestShopPrice(
  shops: readonly ShopPrice[],
  kind: ShopPrice["kind"],
): {
  readonly price_auec: number;
  readonly terminals: number;
  readonly terminal: string;
} | null {
  const rows = shops
    .filter((s) => s.kind === kind)
    .sort((a, b) => a.price_auec - b.price_auec);
  const first = rows[0];
  return first === undefined
    ? null
    : {
        price_auec: first.price_auec,
        terminals: rows.length,
        terminal: first.terminal,
      };
}

export interface ShopRow {
  readonly key: string;
  readonly terminal: string;
  readonly place: string | null;
  readonly system: string | null;
  readonly buy_auec: number | null;
  readonly rent_auec: number | null;
  /** The later of the two reports when a terminal both sells and rents. */
  readonly reported_at: string;
  readonly href: string | null;
}

/** One row per terminal, its purchase and rental prices side by side. */
export function shopRows(shops: readonly ShopPrice[]): ShopRow[] {
  const byTerminal = new Map<string, ShopRow>();
  for (const s of shops) {
    const prev = byTerminal.get(s.terminal);
    const place = [s.location, s.parent]
      .filter((x) => x !== null && x !== "")
      .join(", ");
    const row: ShopRow = {
      key: s.terminal,
      terminal: s.terminal,
      place: prev?.place ?? (place === "" ? null : place),
      system: prev?.system ?? s.system,
      buy_auec: s.kind === "purchase" ? s.price_auec : (prev?.buy_auec ?? null),
      rent_auec: s.kind === "rental" ? s.price_auec : (prev?.rent_auec ?? null),
      reported_at:
        prev === undefined || s.reported_at > prev.reported_at
          ? s.reported_at
          : prev.reported_at,
      href: prev?.href ?? s.source_url,
    };
    byTerminal.set(s.terminal, row);
  }
  return [...byTerminal.values()];
}

/** Store kinds in planning order, with the words the page uses for them. */
export const OFFER_KIND: Readonly<Record<PledgeOffer["kind"], string>> = {
  standalone: "Standalone",
  upgrade: "Upgrade",
  package: "Pack",
  other: "Other",
};
