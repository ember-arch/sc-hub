import { z } from "zod";
import { ClassName, GameVersionString } from "../common.js";
import { ModelTier } from "../enums.js";

/** 3D model tier for a vehicle at a version. Primary key: class_name + game_version + tier. */
export const Model = z.strictObject({
  class_name: ClassName,
  game_version: GameVersionString,
  tier: ModelTier,
  /** CDN path. */
  url: z.string().min(1),
  bytes: z.int().nonnegative(),
  triangles: z.int().nonnegative(),
  texture_count: z.int().nonnegative(),
  checksum: z.string().min(1),
  /** Kill switch: when true the model is purged from the CDN by the next job. */
  takedown: z.boolean(),
});
export type Model = z.infer<typeof Model>;
