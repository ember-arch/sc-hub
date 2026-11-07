import { z } from "zod";
import { Timestamp, Uuid } from "../common.js";
import { ContentSource } from "../enums.js";

/** News item or dev post. Append-only; a source edit creates a new revision. */
export const ContentItem = z.strictObject({
  id: Uuid,
  source: ContentSource,
  /** Source's own id; unique with source. */
  external_id: z.string().min(1),
  /** Canonical link back to the source; always displayed, so only http(s) is allowed. */
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().min(1),
  /** First paragraph or source-provided excerpt; never generated. */
  summary: z.string().nullable(),
  /** Sanitized; quotes and formatting preserved. */
  body_html: z.string(),
  published_at: Timestamp,
  fetched_at: Timestamp,
  /** Increments when the source changes the item. */
  revision: z.int().positive(),
  /** Spectrum only. */
  author_id: Uuid.nullable(),
  thread_id: z.string().nullable(),
  thread_title: z.string().nullable(),
  forum: z.string().nullable(),
  /** Kill switch: when true the item returns 410 and is purged from search. */
  takedown: z.boolean(),
});
export type ContentItem = z.infer<typeof ContentItem>;
