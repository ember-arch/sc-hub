import { type AnyPgColumn, boolean, pgTable, text } from "drizzle-orm/pg-core";
import { vehicleKindEnum, vehicleStatusEnum } from "./enums.js";
import { manufacturer } from "./manufacturer.js";

/** Identity is class_name; slug is computed once and never changes after first publish. */
export const vehicle = pgTable("vehicle", {
  class_name: text().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  manufacturer_code: text()
    .notNull()
    .references(() => manufacturer.code),
  kind: vehicleKindEnum().notNull(),
  status: vehicleStatusEnum().notNull(),
  role: text(),
  size_class: text(),
  base_variant_of: text().references((): AnyPgColumn => vehicle.class_name),
  is_hero: boolean().notNull(),
  first_seen_version: text().notNull(),
  slug_history: text().array().notNull(),
});
