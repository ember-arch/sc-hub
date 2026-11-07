import { Author } from "./entities/author.js";
import { ContentItem } from "./entities/content-item.js";
import { EntityLink } from "./entities/entity-link.js";
import { GameVersion } from "./entities/game-version.js";
import { Item } from "./entities/item.js";
import { ItemStats } from "./entities/item-stats.js";
import { Manufacturer } from "./entities/manufacturer.js";
import { Model } from "./entities/model.js";
import { Paint } from "./entities/paint.js";
import { Port } from "./entities/port.js";
import { Vehicle } from "./entities/vehicle.js";
import { VehicleStats } from "./entities/vehicle-stats.js";

/** Every entity in docs/data-model.md, by name. The JSON Schema emitter and the tests iterate this. */
export const registry = {
  GameVersion,
  Manufacturer,
  Vehicle,
  VehicleStats,
  Port,
  Item,
  ItemStats,
  Paint,
  Model,
  ContentItem,
  Author,
  EntityLink,
} as const;

export type EntityName = keyof typeof registry;
export const entityNames = Object.keys(registry) as EntityName[];
