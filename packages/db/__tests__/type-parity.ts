// Compile-time only: `pnpm typecheck` fails if a table's row type stops matching its Zod type.
// Vitest ignores this file (no .test suffix). Mutual assignability, not a strict Equal, because
// Drizzle's inferred types are intersections that an Equal check would treat as different.

import type {
  Author,
  ContentItem,
  EntityLink,
  GameVersion,
  Item,
  ItemStats,
  Manufacturer,
  Model,
  Paint,
  Port,
  Vehicle,
  VehicleStats,
} from "schema";
import type {
  author,
  contentItem,
  entityLink,
  gameVersion,
  item,
  itemStats,
  manufacturer,
  model,
  paint,
  port,
  vehicle,
  vehicleStats,
} from "../src/schema/index.js";

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Insertable<Row, Insert> = [Row] extends [Insert] ? true : false;
type Check<T extends true> = T;

export type Checks = [
  Check<Mutual<typeof gameVersion.$inferSelect, GameVersion>>,
  Check<Insertable<GameVersion, typeof gameVersion.$inferInsert>>,
  Check<Mutual<typeof manufacturer.$inferSelect, Manufacturer>>,
  Check<Insertable<Manufacturer, typeof manufacturer.$inferInsert>>,
  Check<Mutual<typeof vehicle.$inferSelect, Vehicle>>,
  Check<Insertable<Vehicle, typeof vehicle.$inferInsert>>,
  Check<Mutual<typeof vehicleStats.$inferSelect, VehicleStats>>,
  Check<Insertable<VehicleStats, typeof vehicleStats.$inferInsert>>,
  Check<Mutual<typeof port.$inferSelect, Port>>,
  Check<Insertable<Port, typeof port.$inferInsert>>,
  Check<Mutual<typeof item.$inferSelect, Item>>,
  Check<Insertable<Item, typeof item.$inferInsert>>,
  Check<Mutual<typeof itemStats.$inferSelect, ItemStats>>,
  Check<Insertable<ItemStats, typeof itemStats.$inferInsert>>,
  Check<Mutual<typeof paint.$inferSelect, Paint>>,
  Check<Insertable<Paint, typeof paint.$inferInsert>>,
  Check<Mutual<typeof model.$inferSelect, Model>>,
  Check<Insertable<Model, typeof model.$inferInsert>>,
  Check<Mutual<typeof contentItem.$inferSelect, ContentItem>>,
  Check<Insertable<ContentItem, typeof contentItem.$inferInsert>>,
  Check<Mutual<typeof author.$inferSelect, Author>>,
  Check<Insertable<Author, typeof author.$inferInsert>>,
  Check<Mutual<typeof entityLink.$inferSelect, EntityLink>>,
  Check<Insertable<EntityLink, typeof entityLink.$inferInsert>>,
];
