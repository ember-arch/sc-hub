import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LoanerMatrix, type LoanerRow, PledgeOffer, ShopPrice } from "schema";
import { REPO_ROOT, repo } from "./data";

/**
 * Shops and prices for the ship file (ADR-013): RSI pledge-store offers and UEX Corp's
 * community-reported shop prices, copied by scripts/bootstrap-fixtures/acquisition.ts, and RSI's
 * loaner ship matrix, copied by scripts/bootstrap-fixtures/loaners.ts (ADR-015), all into
 * fixtures/acquisition/. Optional like the other side fixtures: without them the Acquisition
 * section says the prices or loaners are not on file.
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
  "LoanerMatrix.json",
);

const read = (file: string): unknown =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];

export interface Acquisition {
  readonly offers: readonly PledgeOffer[];
  readonly shops: readonly ShopPrice[];
}

let all: Acquisition | undefined;

function load(): Acquisition {
  // Shop prices are reported per build: only the current LIVE build's are shown under its label
  // (CLAUDE.md section 5), so a stale or PTU report never passes for today's price.
  const live = repo().liveVersion;
  all ??= {
    offers: PledgeOffer.array().parse(read(OFFERS_FILE)),
    shops: ShopPrice.array()
      .parse(read(SHOPS_FILE))
      .filter((s) => s.channel === "LIVE" && s.game_version === live),
  };
  return all;
}

let matrix: LoanerMatrix | null | undefined;

function loanerMatrix(): LoanerMatrix | null {
  matrix ??= existsSync(LOANERS_FILE)
    ? LoanerMatrix.parse(JSON.parse(readFileSync(LOANERS_FILE, "utf8")))
    : null;
  return matrix;
}

const words = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The matrix row that names the ship: one of the row's ships, split at " / ", " and " and commas,
 * is the ship's name ("Carrack / Carrack Expedition" names the Carrack, "Carrack w/ C8X" does not),
 * or the row names the ship's family ("Fury Variants"). Null when no row names it.
 */
export function loanerRowFor(
  name: string,
  rows: readonly LoanerRow[],
): LoanerRow | null {
  const ship = words(name);
  for (const row of rows) {
    const parts = row.ships.split(/\s+\/\s+|\s+and\s+|,\s*/i).map(words);
    if (parts.includes(ship)) return row;
    const whole = words(row.ships);
    if (whole === `${ship} variants` || whole === `${ship} series`) return row;
  }
  return null;
}

export interface LoanerView {
  /** What RSI lends for the ship; empty when the matrix does not list it. */
  readonly loaners: readonly string[];
  /** The row's own words for the ship, when listed. */
  readonly listedAs: string | null;
  /** When RSI last edited the matrix, as a date. */
  readonly editedOn: string;
  readonly build: string | null;
  readonly url: string;
}

/** The ship's loaners per RSI's matrix; null when the matrix is not on file. */
export function loanerFor(name: string): LoanerView | null {
  const m = loanerMatrix();
  if (m === null) return null;
  const row = loanerRowFor(name, m.rows);
  return {
    loaners: row?.loaners ?? [],
    listedAs: row?.ships ?? null,
    editedOn: m.edited_at.slice(0, 10),
    build: m.stated_build,
    url: m.article_url,
  };
}

/** The Loaners fact's value: the loaners and the matrix's date, or why there are none. */
export function loanerValue(view: LoanerView | null, flyable: boolean): string {
  if (view === null) return "Not on file";
  if (view.loaners.length === 0)
    return flyable
      ? `None; flight ready, not on RSI's loaner matrix (${view.editedOn})`
      : `Not on RSI's loaner matrix (${view.editedOn})`;
  return `${view.loaners.join(", ")}, per RSI's loaner matrix (${view.editedOn})`;
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

export interface ShipPrices {
  readonly pledge: PledgeValue | null;
  readonly buy_auec: number | null;
  readonly rent_auec: number | null;
}

/** The headline prices the compare page and the indexes show (ADR-013). */
export function pricesFor(slug: string, className: string | null): ShipPrices {
  const a = acquisitionFor(slug, className);
  return {
    pledge: pledgeValue(a.offers),
    buy_auec: lowestShopPrice(a.shops, "purchase")?.price_auec ?? null,
    rent_auec: lowestShopPrice(a.shops, "rental")?.price_auec ?? null,
  };
}

/** When the price fixtures were last copied, for credit lines; null without them. */
export function pricesCopiedAt(): string | null {
  const a = load();
  const times = [...a.offers, ...a.shops].map((row) => row.fetched_at).sort();
  return times.at(-1) ?? null;
}
