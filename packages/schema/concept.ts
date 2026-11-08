import { z } from "zod";
import { ManufacturerCode, Slug, Timestamp } from "./common.js";

/**
 * A ship CIG has published but the game does not contain yet (ADR-010): its figures are the ones
 * RSI's ship matrix states, copied by `scripts/media/snapshot-matrix.ts`, never typed in. Shown
 * with "In concept" and the source on every figure; nothing here enters the data pack.
 */
export const ConceptShip = z.strictObject({
  slug: Slug,
  name: z.string().min(1),
  manufacturer_code: ManufacturerCode,
  /** RSI's focus line, for example "Battlecruiser". */
  focus: z.string().nullable(),
  size: z.string().nullable(),
  production_status: z.string(),
  length_m: z.number().positive().nullable(),
  beam_m: z.number().positive().nullable(),
  height_m: z.number().positive().nullable(),
  mass_kg: z.number().positive().nullable(),
  crew_min: z.number().int().nonnegative().nullable(),
  crew_max: z.number().int().nonnegative().nullable(),
  cargo_scu: z.number().nonnegative().nullable(),
  scm_speed: z.number().positive().nullable(),
  /** RSI's own ship-matrix description, verbatim. */
  description: z.string(),
  page_url: z.url(),
  source: z.literal("rsi_ship_matrix"),
  fetched_at: Timestamp,
});
export type ConceptShip = z.infer<typeof ConceptShip>;
