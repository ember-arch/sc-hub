import { z } from "zod";
import { ClassName, GameVersionString, Slug, Timestamp } from "../common.js";
import { Channel } from "../enums.js";

/**
 * Shops and prices for the ship file (ADR-013). Neither is game data: pledge offers come from
 * RSI's pledge store and in-game prices from UEX Corp's community reports. Both are copied by
 * `scripts/bootstrap-fixtures/acquisition.ts`, never typed in, and live beside the data pack in
 * `fixtures/acquisition/` with their source and the time they were read.
 */

/** An item on RSI's pledge store that is the ship, upgrades to it, or contains it. */
export const PledgeOffer = z.strictObject({
  slug: Slug,
  /** Null for a concept ship the game does not contain yet. */
  class_name: ClassName.nullable(),
  title: z.string().min(1),
  /** From the item's store section and pack flag; `other` keeps the section name as served. */
  kind: z.enum(["standalone", "upgrade", "package", "other"]),
  /** The store section in the item's URL with hyphens as spaces, for example "Standalone Ships". */
  store_section: z.string().nullable(),
  price_usd: z.number().positive(),
  discounted_price_usd: z.number().positive().nullable(),
  /** Null where the source does not say. */
  warbond: z.boolean().nullable(),
  available: z.boolean(),
  url: z.url(),
  /** When the store was read: the wiki's import time, or ours for RSI's own page. */
  observed_at: Timestamp,
  via: z.enum(["star_citizen_wiki_api", "rsi_pledge_page"]),
  fetched_at: Timestamp,
});
export type PledgeOffer = z.infer<typeof PledgeOffer>;

/** One shop terminal's reported price to buy or rent the ship in the game, for one build. */
export const ShopPrice = z.strictObject({
  class_name: ClassName,
  channel: Channel,
  game_version: GameVersionString,
  kind: z.enum(["purchase", "rental"]),
  /** As UEX lists it; UEX does not state a rental period. */
  price_auec: z.number().positive(),
  terminal: z.string().min(1),
  location: z.string().nullable(),
  parent: z.string().nullable(),
  system: z.string().nullable(),
  /** When the price was last reported to UEX. */
  reported_at: Timestamp,
  source_url: z.url().nullable(),
  via: z.literal("star_citizen_wiki_api"),
  fetched_at: Timestamp,
});
export type ShopPrice = z.infer<typeof ShopPrice>;

/** One row of RSI's loaner ship matrix: the ships as RSI names them, and what RSI lends for them. */
export const LoanerRow = z.strictObject({
  /** The "Your ship" cell, verbatim: one ship, several joined with "/" or "and", or "Fury Variants". */
  ships: z.string().min(1),
  /** The "Our loaner(s)" cell, split at its commas. */
  loaners: z.array(z.string().min(1)).min(1),
});
export type LoanerRow = z.infer<typeof LoanerRow>;

/**
 * RSI's loaner ship matrix (ADR-015): the support article that lists, for every ship not yet
 * flight ready, the ships RSI lends its owners. Copied whole by `scripts/bootstrap-fixtures/loaners.ts`
 * from the help centre's public article API; a weekly workflow checks it for changes.
 */
export const LoanerMatrix = z.strictObject({
  article_url: z.url(),
  api_url: z.url(),
  title: z.string().min(1),
  /** When RSI last edited the article. */
  edited_at: Timestamp,
  /** The article's own "Last updated" date and build, as written, when it states them. */
  stated_date: z.string().nullable(),
  stated_build: z.string().nullable(),
  rows: z.array(LoanerRow).min(1),
  fetched_at: Timestamp,
});
export type LoanerMatrix = z.infer<typeof LoanerMatrix>;
