import {
  bigint,
  boolean,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { channelEnum, modelTierEnum } from "./enums.js";
import { gameVersion } from "./game-version.js";
import { vehicle } from "./vehicle.js";

/** 3D model tier for a vehicle at a version. */
export const model = pgTable(
  "model",
  {
    class_name: text()
      .notNull()
      .references(() => vehicle.class_name),
    channel: channelEnum().notNull(),
    game_version: text().notNull(),
    tier: modelTierEnum().notNull(),
    url: text().notNull(),
    bytes: bigint({ mode: "number" }).notNull(),
    triangles: integer().notNull(),
    texture_count: integer().notNull(),
    checksum: text().notNull(),
    takedown: boolean().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.class_name, t.channel, t.game_version, t.tier] }),
    foreignKey({
      name: "model_game_version_fk",
      columns: [t.channel, t.game_version],
      foreignColumns: [gameVersion.channel, gameVersion.version],
    }),
  ],
);
