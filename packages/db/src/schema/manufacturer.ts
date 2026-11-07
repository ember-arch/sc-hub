import { pgTable, text } from "drizzle-orm/pg-core";

export const manufacturer = pgTable("manufacturer", {
  code: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  description: text().notNull(),
  logo_asset: text(),
});
