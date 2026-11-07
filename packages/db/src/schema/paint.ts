import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { vehicle } from "./vehicle.js";

export const paint = pgTable("paint", {
  id: uuid().primaryKey(),
  class_name: text()
    .notNull()
    .references(() => vehicle.class_name),
  name: text().notNull(),
  preview_asset: text(),
});
