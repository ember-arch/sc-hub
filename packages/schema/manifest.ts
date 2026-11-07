import { z } from "zod";
import { GameVersionString, Timestamp } from "./common.js";
import { Channel } from "./enums.js";
import { entityNames } from "./registry.js";

/**
 * One file inside a data pack: a JSON array of one entity type. `sha256` is the hex digest of the
 * file's bytes; `count` is the number of rows, so a consumer can verify before it parses.
 */
export const ManifestFile = z.strictObject({
  /** File name relative to the pack folder, for example `Vehicle.json`. */
  name: z.string().min(1),
  entity: z.enum(entityNames),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex characters"),
  bytes: z.int().nonnegative(),
  count: z.int().nonnegative(),
});
export type ManifestFile = z.infer<typeof ManifestFile>;

/**
 * The index of a data pack (CLAUDE.md section 11): one version of one channel, the files it holds,
 * their checksums and record counts. The bootstrap fixtures, the pipeline's publish step and the
 * import job all read and write this shape, so a pack from any source loads the same way.
 */
export const Manifest = z.strictObject({
  /** Bumped only when this manifest shape changes incompatibly. */
  schema_version: z.literal(1),
  channel: Channel,
  game_version: GameVersionString,
  /** When the pack was built. */
  created_at: Timestamp,
  /** Who produced the pack, for example `wiki-bootstrap` or `pipeline`. */
  source: z.string().min(1),
  /** Where the data came from, when it was not the game files. */
  source_url: z.url({ protocol: /^https?$/ }).nullable(),
  /** Credit line that must display while this pack's data is shown; null when none is required. */
  credit: z.string().nullable(),
  files: z.array(ManifestFile).min(1),
});
export type Manifest = z.infer<typeof Manifest>;
