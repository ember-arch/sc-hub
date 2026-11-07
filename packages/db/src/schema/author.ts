import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./columns.js";

/** CIG staff on Spectrum. No avatars, no personal details beyond what Spectrum shows on the post. */
export const author = pgTable("author", {
  id: uuid().primaryKey(),
  handle: text().notNull().unique(),
  display_name: text().notNull(),
  role: text(),
  first_seen: isoTimestamp().notNull(),
  post_count: integer().notNull(),
  takedown: boolean().notNull(),
});
