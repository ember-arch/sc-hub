import {
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { channelEnum } from "./enums.js";
import { gameVersion } from "./game-version.js";
import { vehicle } from "./vehicle.js";

/** One row per vehicle per channel per version. The game_version FK makes "no unversioned stat" a database invariant. */
export const vehicleStats = pgTable(
  "vehicle_stats",
  {
    class_name: text()
      .notNull()
      .references(() => vehicle.class_name),
    channel: channelEnum().notNull(),
    game_version: text().notNull(),
    length_m: doublePrecision().notNull(),
    beam_m: doublePrecision().notNull(),
    height_m: doublePrecision().notNull(),
    mass_kg: doublePrecision().notNull(),
    cargo_scu: doublePrecision(),
    crew_min: integer().notNull(),
    crew_max: integer().notNull(),
    hull_hp: doublePrecision(),
    scm_speed: doublePrecision(),
    nav_speed: doublePrecision(),
    hydrogen_fuel: doublePrecision(),
    quantum_fuel: doublePrecision(),
    hydrogen_capacity: doublePrecision(),
    quantum_capacity: doublePrecision(),
    raw: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.class_name, t.channel, t.game_version] }),
    foreignKey({
      name: "vehicle_stats_game_version_fk",
      columns: [t.channel, t.game_version],
      foreignColumns: [gameVersion.channel, gameVersion.version],
    }),
  ],
);
