import { z } from "zod";
import { ClassName, GameVersionString } from "../common.js";
import { Channel, PortType } from "../enums.js";

/**
 * Hardpoint. One row per port per vehicle per channel per version. Keyed by `port_path` because the
 * game reuses port names under different parents (each missile rack has a `missile_01_attach`).
 */
export const Port = z.strictObject({
  class_name: ClassName,
  channel: Channel,
  game_version: GameVersionString,
  /** Parent paths joined by `/`, for example `hardpoint_gun_nose/hardpoint_class_2`. Part of the primary key. */
  port_path: z.string().min(1),
  /** Game port name; the last segment of `port_path`. */
  port_name: z.string().min(1),
  port_type: PortType,
  size_min: z.int(),
  size_max: z.int(),
  /** Nested ports (a turret's weapon ports) point at their parent's `port_path`. */
  parent_port_path: z.string().min(1).nullable(),
  /** Stock loadout. */
  default_item_class: ClassName.nullable(),
  /** Human label if the game provides one. */
  position: z.string().nullable(),
});
export type Port = z.infer<typeof Port>;
