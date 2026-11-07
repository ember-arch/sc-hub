import { z } from "zod";
import { Timestamp, Uuid } from "../common.js";

/** CIG staff on Spectrum. No avatars, no personal details beyond what Spectrum shows on the post. */
export const Author = z.strictObject({
  id: Uuid,
  handle: z.string().min(1),
  display_name: z.string().min(1),
  /** As shown on Spectrum (badge or title). */
  role: z.string().nullable(),
  first_seen: Timestamp,
  /** Derived. */
  post_count: z.int().nonnegative(),
  /** Kill switch: removes the author page and hides all posts. */
  takedown: z.boolean(),
});
export type Author = z.infer<typeof Author>;
