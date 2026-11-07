import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { contentItem } from "./content-item.js";
import { entityTypeEnum } from "./enums.js";

/** A resolved mention of an entity inside a content item. Displays at confidence >= 0.9 or when confirmed. */
export const entityLink = pgTable(
  "entity_link",
  {
    content_item_id: uuid()
      .notNull()
      .references(() => contentItem.id),
    entity_type: entityTypeEnum().notNull(),
    entity_key: text().notNull(),
    matched_text: text().notNull(),
    char_start: integer().notNull(),
    char_end: integer().notNull(),
    confidence: doublePrecision().notNull(),
    confirmed: boolean().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.content_item_id, t.entity_type, t.entity_key, t.char_start],
    }),
  ],
);
