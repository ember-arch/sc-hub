import type { z } from "zod";
import type { EntityName, registry } from "./registry.js";

/** The parsed row type of one entity, by name. */
export type Entity<K extends EntityName> = z.infer<(typeof registry)[K]>;

/**
 * Primary key fields per entity (docs/data-model.md). The pack parser uses them to find duplicate
 * rows, the database tables declare the same keys, and packs are sorted by them so diffs stay stable.
 */
export const primaryKeys = {
  GameVersion: ["id"],
  Manufacturer: ["code"],
  Vehicle: ["class_name"],
  VehicleStats: ["class_name", "channel", "game_version"],
  Port: ["class_name", "channel", "game_version", "port_name"],
  Item: ["class_name"],
  ItemStats: ["class_name", "channel", "game_version"],
  Paint: ["id"],
  Model: ["class_name", "channel", "game_version", "tier"],
  ContentItem: ["id"],
  Author: ["id"],
  EntityLink: ["content_item_id", "entity_type", "entity_key", "char_start"],
} as const satisfies Record<EntityName, readonly string[]>;

/** One string per row that is equal exactly when the primary keys are equal. */
export function primaryKeyOf<K extends EntityName>(
  entity: K,
  row: Entity<K>,
): string {
  const record = row as Record<string, unknown>;
  return primaryKeys[entity]
    .map((field) => JSON.stringify(record[field]))
    .join("|");
}
