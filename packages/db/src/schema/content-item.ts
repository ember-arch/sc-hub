import {
  boolean,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { author } from "./author.js";
import { isoTimestamp } from "./columns.js";
import { contentSourceEnum } from "./enums.js";

/** Append-only with revisions: one row per revision, the newest displays (ADR-004 reading of the data model). */
export const contentItem = pgTable(
  "content_item",
  {
    id: uuid().primaryKey(),
    source: contentSourceEnum().notNull(),
    external_id: text().notNull(),
    url: text().notNull(),
    title: text().notNull(),
    summary: text(),
    body_html: text().notNull(),
    published_at: isoTimestamp().notNull(),
    fetched_at: isoTimestamp().notNull(),
    revision: integer().notNull(),
    author_id: uuid().references(() => author.id),
    thread_id: text(),
    thread_title: text(),
    forum: text(),
    takedown: boolean().notNull(),
  },
  (t) => [
    unique("content_item_source_external_id_revision").on(
      t.source,
      t.external_id,
      t.revision,
    ),
  ],
);
