import {
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { channelEnum, portTypeEnum } from "./enums.js";
import { gameVersion } from "./game-version.js";
import { item } from "./item.js";
import { vehicle } from "./vehicle.js";

/**
 * Hardpoint. One row per port per vehicle per channel per version, keyed by port_path because the
 * game reuses port names under different parents; nested ports point at their parent's path.
 */
export const port = pgTable(
  "port",
  {
    class_name: text()
      .notNull()
      .references(() => vehicle.class_name),
    channel: channelEnum().notNull(),
    game_version: text().notNull(),
    port_path: text().notNull(),
    port_name: text().notNull(),
    port_type: portTypeEnum().notNull(),
    size_min: integer().notNull(),
    size_max: integer().notNull(),
    parent_port_path: text(),
    default_item_class: text().references(() => item.class_name),
    position: text(),
  },
  (t) => [
    primaryKey({
      columns: [t.class_name, t.channel, t.game_version, t.port_path],
    }),
    foreignKey({
      name: "port_game_version_fk",
      columns: [t.channel, t.game_version],
      foreignColumns: [gameVersion.channel, gameVersion.version],
    }),
    foreignKey({
      name: "port_parent_fk",
      columns: [t.class_name, t.channel, t.game_version, t.parent_port_path],
      foreignColumns: [t.class_name, t.channel, t.game_version, t.port_path],
    }),
  ],
);
