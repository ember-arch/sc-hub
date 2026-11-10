import { z } from "zod";
import { GameVersionString, Timestamp } from "../common.js";
import { Channel } from "../enums.js";

/**
 * The standard cargo containers' shapes (ADR-028): one row per container size in SCU, with the
 * dimensions the game gives that size, read from the Star Citizen Wiki API's cargo item records
 * by `scripts/bootstrap-fixtures/cargo-boxes.ts` and never typed in. The ship file's cargo
 * section fills each grid of a ship with boxes of one size from these shapes and the grid's own
 * dimensions in the vehicle's record.
 */
export const CargoBox = z.strictObject({
  scu: z.number().int().positive(),
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  length_m: z.number().positive(),
  /** One of the records the shape was read from. */
  example_class_name: z.string().min(1),
  /** How many records of this size agreed on the shape. */
  records: z.number().int().positive(),
});
export type CargoBox = z.infer<typeof CargoBox>;

export const CargoBoxes = z.strictObject({
  channel: Channel,
  game_version: GameVersionString,
  fetched_at: Timestamp,
  source_url: z.url(),
  via: z.literal("star_citizen_wiki_api"),
  rows: z.array(CargoBox).min(1),
});
export type CargoBoxes = z.infer<typeof CargoBoxes>;
