import { z } from "zod";
import { ClassName, GameVersionString, Raw } from "../common.js";
import { Channel } from "../enums.js";

/**
 * One row per item per channel per version. Type-specific fields stay null for other types;
 * one table for all item types in v1 (data-model rule under ItemStats).
 */
export const ItemStats = z.strictObject({
  class_name: ClassName,
  channel: Channel,
  game_version: GameVersionString,
  hp: z.number().nullable(),
  power_draw: z.number().nullable(),
  power_output: z.number().nullable(),
  heat_generation: z.number().nullable(),
  cooling_rate: z.number().nullable(),
  em_signature: z.number().nullable(),
  ir_signature: z.number().nullable(),
  /** Weapons only. */
  weapon_damage: z.number().nullable(),
  weapon_fire_rate: z.number().nullable(),
  weapon_range: z.number().nullable(),
  projectile_speed: z.number().nullable(),
  /** Shields only. */
  shield_hp: z.number().nullable(),
  shield_regen: z.number().nullable(),
  shield_delay: z.number().nullable(),
  /** Quantum drives only. */
  qd_speed: z.number().nullable(),
  qd_range: z.number().nullable(),
  qd_fuel_per_jump: z.number().nullable(),
  qd_spool_time: z.number().nullable(),
  /** Everything else, including per-type fields not listed. */
  raw: Raw,
});
export type ItemStats = z.infer<typeof ItemStats>;
