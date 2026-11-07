import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { itemTypeEnum } from "./enums.js";
import { manufacturer } from "./manufacturer.js";

/** Component. */
export const item = pgTable("item", {
  class_name: text().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  manufacturer_code: text()
    .notNull()
    .references(() => manufacturer.code),
  type: itemTypeEnum().notNull(),
  subtype: text(),
  size: integer().notNull(),
  grade: text(),
  item_class: text(),
  first_seen_version: text().notNull(),
});
