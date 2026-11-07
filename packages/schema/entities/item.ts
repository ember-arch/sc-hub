import { z } from "zod";
import {
  ClassName,
  GameVersionString,
  ManufacturerCode,
  Slug,
} from "../common.js";
import { ItemType } from "../enums.js";

/** Component. */
export const Item = z.strictObject({
  class_name: ClassName,
  slug: Slug,
  name: z.string().min(1),
  manufacturer_code: ManufacturerCode,
  type: ItemType,
  /** For example ballistic gatling, laser repeater. */
  subtype: z.string().nullable(),
  size: z.int(),
  /** A to D where the game has it. */
  grade: z.string().nullable(),
  /** military, civilian, industrial, stealth, competition. */
  item_class: z.string().nullable(),
  first_seen_version: GameVersionString,
});
export type Item = z.infer<typeof Item>;
