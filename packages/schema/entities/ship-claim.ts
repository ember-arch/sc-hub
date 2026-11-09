import { z } from "zod";
import { Timestamp } from "../common.js";

/**
 * What CIG has stated about a concept ship the game has no data for (ADR-012): a neutral fact,
 * backed by a verbatim quote from the ship's Comm-Link that `scripts/media/claims.ts` checks is
 * in the article. Marketing statements, not game data; ships in the game data carry none.
 */
export const ShipClaim = z.strictObject({
  slug: z.string().min(1),
  section: z.enum(["operations", "combat", "logistics", "command"]),
  label: z.string().min(1),
  value: z.string().min(1),
  quote: z.string().min(1),
  source_url: z.url(),
  source_title: z.string().min(1),
  published_at: Timestamp,
});
export type ShipClaim = z.infer<typeof ShipClaim>;
