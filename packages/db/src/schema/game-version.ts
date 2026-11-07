import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { isoTimestamp } from "./columns.js";
import { channelEnum } from "./enums.js";

/** One detected build of one channel. Exactly one row per channel has is_current true. */
export const gameVersion = pgTable(
  "game_version",
  {
    id: uuid().primaryKey(),
    channel: channelEnum().notNull(),
    version: text().notNull(),
    detected_at: isoTimestamp().notNull(),
    published_at: isoTimestamp(),
    manifest_url: text().notNull(),
    is_current: boolean().notNull(),
  },
  (t) => [
    unique("game_version_channel_version").on(t.channel, t.version),
    uniqueIndex("game_version_one_current_per_channel")
      .on(t.channel)
      .where(sql`${t.is_current}`),
  ],
);
