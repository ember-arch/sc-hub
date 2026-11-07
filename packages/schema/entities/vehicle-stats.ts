import { z } from "zod";
import { ClassName, GameVersionString, Raw } from "../common.js";
import { Channel } from "../enums.js";

/** One row per vehicle per channel per version. There is no unversioned stat anywhere. */
export const VehicleStats = z.strictObject({
  class_name: ClassName,
  channel: Channel,
  game_version: GameVersionString,
  length_m: z.number(),
  beam_m: z.number(),
  height_m: z.number(),
  mass_kg: z.number(),
  cargo_scu: z.number().nullable(),
  crew_min: z.int(),
  crew_max: z.int(),
  hull_hp: z.number().nullable(),
  /** m/s */
  scm_speed: z.number().nullable(),
  /** m/s */
  nav_speed: z.number().nullable(),
  hydrogen_fuel: z.number().nullable(),
  quantum_fuel: z.number().nullable(),
  hydrogen_capacity: z.number().nullable(),
  quantum_capacity: z.number().nullable(),
  /** Unmapped remainder. */
  raw: Raw,
});
export type VehicleStats = z.infer<typeof VehicleStats>;
