import { z } from "zod";
import { GameVersionString, Timestamp, Uuid } from "../common.js";
import { Channel } from "../enums.js";

/** One detected build of one channel. Exactly one row per channel has `is_current` true. */
export const GameVersion = z.strictObject({
  id: Uuid,
  channel: Channel,
  version: GameVersionString,
  /** When the pipeline saw it. */
  detected_at: Timestamp,
  /** When the import flipped the pointer; null until then. */
  published_at: Timestamp.nullable(),
  /** R2 path of the data pack manifest. */
  manifest_url: z.string().min(1),
  is_current: z.boolean(),
});
export type GameVersion = z.infer<typeof GameVersion>;
