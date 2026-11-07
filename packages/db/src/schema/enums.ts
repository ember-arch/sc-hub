import { pgEnum } from "drizzle-orm/pg-core";
import {
  Channel,
  ContentSource,
  EntityType,
  ItemType,
  ModelTier,
  PortType,
  VehicleKind,
  VehicleStatus,
} from "schema";

/** Zod 4 exposes enum members as an array; pgEnum wants a non-empty tuple. */
function enumTuple<T extends string>(options: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = options;
  if (first === undefined) {
    throw new Error("an enumeration needs at least one member");
  }
  return [first, ...rest];
}

// Postgres enum types, one per enumeration in packages/schema. The members come from the Zod
// enums at runtime, so the two can never drift; parity.test.ts asserts it anyway.
export const channelEnum = pgEnum("channel", enumTuple(Channel.options));
export const vehicleStatusEnum = pgEnum(
  "vehicle_status",
  enumTuple(VehicleStatus.options),
);
export const vehicleKindEnum = pgEnum(
  "vehicle_kind",
  enumTuple(VehicleKind.options),
);
export const itemTypeEnum = pgEnum("item_type", enumTuple(ItemType.options));
export const portTypeEnum = pgEnum("port_type", enumTuple(PortType.options));
export const contentSourceEnum = pgEnum(
  "content_source",
  enumTuple(ContentSource.options),
);
export const entityTypeEnum = pgEnum(
  "entity_type",
  enumTuple(EntityType.options),
);
export const modelTierEnum = pgEnum("model_tier", enumTuple(ModelTier.options));

/** The Postgres enums keyed like `enums` in packages/schema, for tests and tooling. */
export const pgEnums = {
  Channel: channelEnum,
  VehicleStatus: vehicleStatusEnum,
  VehicleKind: vehicleKindEnum,
  ItemType: itemTypeEnum,
  PortType: portTypeEnum,
  ContentSource: contentSourceEnum,
  EntityType: entityTypeEnum,
  ModelTier: modelTierEnum,
} as const;
