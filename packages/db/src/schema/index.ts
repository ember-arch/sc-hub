import type { PgTable } from "drizzle-orm/pg-core";
import type { EntityName } from "schema";
import { author } from "./author.js";
import { contentItem } from "./content-item.js";
import { entityLink } from "./entity-link.js";
import { gameVersion } from "./game-version.js";
import { item } from "./item.js";
import { itemStats } from "./item-stats.js";
import { manufacturer } from "./manufacturer.js";
import { model } from "./model.js";
import { paint } from "./paint.js";
import { port } from "./port.js";
import { vehicle } from "./vehicle.js";
import { vehicleStats } from "./vehicle-stats.js";

export * from "./author.js";
export * from "./columns.js";
export * from "./content-item.js";
export * from "./entity-link.js";
export * from "./enums.js";
export * from "./game-version.js";
export * from "./item.js";
export * from "./item-stats.js";
export * from "./manufacturer.js";
export * from "./model.js";
export * from "./paint.js";
export * from "./port.js";
export * from "./vehicle.js";
export * from "./vehicle-stats.js";

/** Every table keyed by its entity name in packages/schema, so the seed and the tests iterate the registry. */
export const tables = {
  GameVersion: gameVersion,
  Manufacturer: manufacturer,
  Vehicle: vehicle,
  VehicleStats: vehicleStats,
  Port: port,
  Item: item,
  ItemStats: itemStats,
  Paint: paint,
  Model: model,
  ContentItem: contentItem,
  Author: author,
  EntityLink: entityLink,
} as const satisfies Record<EntityName, PgTable>;

/** Insert order that satisfies every foreign key. */
export const seedOrder = [
  "GameVersion",
  "Manufacturer",
  "Vehicle",
  "Item",
  "VehicleStats",
  "ItemStats",
  "Port",
  "Paint",
  "Model",
  "Author",
  "ContentItem",
  "EntityLink",
] as const satisfies readonly EntityName[];
