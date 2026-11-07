import {
  doublePrecision,
  foreignKey,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { channelEnum } from "./enums.js";
import { gameVersion } from "./game-version.js";
import { item } from "./item.js";

/** One row per item per channel per version. Type-specific fields stay null for other types. */
export const itemStats = pgTable(
  "item_stats",
  {
    class_name: text()
      .notNull()
      .references(() => item.class_name),
    channel: channelEnum().notNull(),
    game_version: text().notNull(),
    hp: doublePrecision(),
    power_draw: doublePrecision(),
    power_output: doublePrecision(),
    heat_generation: doublePrecision(),
    cooling_rate: doublePrecision(),
    em_signature: doublePrecision(),
    ir_signature: doublePrecision(),
    weapon_damage: doublePrecision(),
    weapon_fire_rate: doublePrecision(),
    weapon_range: doublePrecision(),
    projectile_speed: doublePrecision(),
    shield_hp: doublePrecision(),
    shield_regen: doublePrecision(),
    shield_delay: doublePrecision(),
    qd_speed: doublePrecision(),
    qd_range: doublePrecision(),
    qd_fuel_per_jump: doublePrecision(),
    qd_spool_time: doublePrecision(),
    raw: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.class_name, t.channel, t.game_version] }),
    foreignKey({
      name: "item_stats_game_version_fk",
      columns: [t.channel, t.game_version],
      foreignColumns: [gameVersion.channel, gameVersion.version],
    }),
  ],
);
