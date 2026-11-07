import { z } from "zod";
import { ClassName, GameVersionString } from "../common.js";
import { Channel, PortType } from "../enums.js";

/** Hardpoint. One row per port per vehicle per channel per version. */
export const Port = z.strictObject({
  class_name: ClassName,
  channel: Channel,
  game_version: GameVersionString,
  /** Game port name; part of the primary key. */
  port_name: z.string().min(1),
  port_type: PortType,
  size_min: z.int(),
  size_max: z.int(),
  /** Nested ports (a turret's weapon ports). */
  parent_port_name: z.string().nullable(),
  /** Stock loadout. */
  default_item_class: ClassName.nullable(),
  /** Human label if the game provides one. */
  position: z.string().nullable(),
});
export type Port = z.infer<typeof Port>;
