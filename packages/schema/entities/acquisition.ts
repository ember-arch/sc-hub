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

/** A vehicle RSI lends to owners of the ship, as the Star Citizen Wiki API lists it. */
export const ShipLoaner = z.strictObject({
  class_name: ClassName,
  loaner_name: z.string().min(1),
  /** The loaner's wiki uuid, the identity the wiki uses for it. */
  loaner_uuid: z.uuid(),
  via: z.literal("star_citizen_wiki_api"),
  fetched_at: Timestamp,
});
export type ShipLoaner = z.infer<typeof ShipLoaner>;
