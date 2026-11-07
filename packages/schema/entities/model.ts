import { z } from "zod";
import { ClassName, GameVersionString } from "../common.js";
import { Channel, ModelTier } from "../enums.js";

/**
 * 3D model tier for a vehicle at a version. Primary key: class_name + channel + game_version + tier.
 * Like every other versioned row it carries channel and game_version (CLAUDE.md section 5).
 */
export const Model = z.strictObject({
  class_name: ClassName,
  channel: Channel,
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
