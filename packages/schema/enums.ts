import { z } from "zod";

export const Channel = z.enum(["LIVE", "PTU", "EPTU"]);
export type Channel = z.infer<typeof Channel>;

export const VehicleStatus = z.enum([
  "flight_ready",
  "in_production",
  "concept",
]);
export type VehicleStatus = z.infer<typeof VehicleStatus>;

export const VehicleKind = z.enum(["ship", "ground_vehicle"]);
export type VehicleKind = z.infer<typeof VehicleKind>;

export const ItemType = z.enum([
  "weapon",
  "turret",
  "missile_rack",
  "missile",
  "shield",
  "power_plant",
  "cooler",
  "quantum_drive",
  "radar",
  "fuel_tank",
  "fuel_intake",
  "jump_module",
  "thruster",
  "armor",
  "utility",
  "mining_laser",
  "tractor_beam",
  "countermeasure",
  "other",
]);
export type ItemType = z.infer<typeof ItemType>;

/** Same set as ItemType plus the port-only kinds. */
export const PortType = z.enum([
  ...ItemType.options,
  "paint",
  "interior",
  "cargo_grid",
]);
export type PortType = z.infer<typeof PortType>;

export const ContentSource = z.enum([
  "comm_link",
  "patch_notes",
  "roadmap",
  "progress_tracker",
  "video",
  "spectrum",
]);
export type ContentSource = z.infer<typeof ContentSource>;

export const EntityType = z.enum(["vehicle", "item", "manufacturer", "author"]);
export type EntityType = z.infer<typeof EntityType>;

export const ModelTier = z.enum(["preview", "full"]);
export type ModelTier = z.infer<typeof ModelTier>;

/** Every enumeration, by name, for tests and tooling. */
export const enums = {
  Channel,
  VehicleStatus,
  VehicleKind,
  ItemType,
  PortType,
  ContentSource,
  EntityType,
  ModelTier,
} as const;
