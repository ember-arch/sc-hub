import { z } from "zod";
import { ClassName, GameVersionString, Timestamp } from "../common.js";
import { Channel } from "../enums.js";

/**
 * CIG's own text about a ship for one build: the game localization, or the ship matrix when the
 * game has none. Copied by a script, never written by hand (CLAUDE.md section 2). Proposed with
 * the cinematic ship page concept (ADR-008); it lives beside the data pack in
 * `fixtures/descriptions/` until the owner approves it as part of the pack and the database.
 */
export const VehicleDescription = z.strictObject({
  class_name: ClassName,
  channel: Channel,
  game_version: GameVersionString,
  /** The text as served, minus a leading "Manufacturer: / Focus:" header block. */
  text: z.string().min(1),
  source: z.enum(["localization", "ship_matrix"]),
  fetched_at: Timestamp,
});
export type VehicleDescription = z.infer<typeof VehicleDescription>;
