import { z } from "zod";
import { Uuid } from "../common.js";
import { EntityType } from "../enums.js";

/** A resolved mention of an entity inside a content item. Displays at confidence >= 0.9 or when confirmed. */
export const EntityLink = z.strictObject({
  content_item_id: Uuid,
  entity_type: EntityType,
  /** class_name, manufacturer code, or author id. */
  entity_key: z.string().min(1),
  matched_text: z.string().min(1),
  char_start: z.int().nonnegative(),
  char_end: z.int().nonnegative(),
  confidence: z.number().min(0).max(1),
  /** Manual confirmation flips low-confidence links visible. */
  confirmed: z.boolean(),
});
export type EntityLink = z.infer<typeof EntityLink>;

/** The display rule from docs/data-model.md, in one place. */
export const ENTITY_LINK_DISPLAY_THRESHOLD = 0.9;
export function isEntityLinkVisible(
  link: Pick<EntityLink, "confidence" | "confirmed">,
): boolean {
  return link.confirmed || link.confidence >= ENTITY_LINK_DISPLAY_THRESHOLD;
}
