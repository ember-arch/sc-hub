/**
 * The `feed` implementation (spec 03): a CIG-provided export or webhook of staff posts, format
 * to be agreed with CIG. Until then this stub documents the JSON shape the project would accept
 * and validates it: an array of posts in the adapter's own terms, served at `SPECTRUM_FEED_URL`.
 * Anything else halts.
 */
import { z } from "zod";
import type { SpectrumAdapter, StaffPost } from "../adapter.js";

export const FeedPost = z.object({
  id: z.string().min(1),
  kind: z.enum(["op", "reply"]),
  thread_id: z.string().min(1),
  thread_title: z.string().min(1),
  forum: z.string().min(1),
  url: z.url(),
  body: z.string(),
  published_at: z.iso.datetime({ offset: true }),
  edited_at: z.iso.datetime({ offset: true }).nullable(),
  author: z.object({
    handle: z.string().min(1),
    display_name: z.string().min(1),
    role: z.string().nullable(),
  }),
});
export const FeedDocument = z.object({
  /** The shape's version, so a change is a halt, not a surprise. */
  version: z.literal(1),
  posts: z.array(FeedPost),
});
export type FeedDocument = z.infer<typeof FeedDocument>;

export function createFeedAdapter(options: {
  readonly url: string;
  readonly fetch: (
    url: string,
    init: { headers: Record<string, string> },
  ) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  readonly userAgent: string;
}): SpectrumAdapter {
  return {
    async fetchNewStaffPosts(since) {
      const response = await options.fetch(options.url, {
        headers: {
          "User-Agent": options.userAgent,
          Accept: "application/json",
        },
      });
      if (!response.ok)
        throw new Error(`Spectrum feed answered ${response.status}`);
      const doc = FeedDocument.parse(JSON.parse(await response.text()));
      const posts: StaffPost[] = doc.posts
        .filter((p) => new Date(p.edited_at ?? p.published_at) > since)
        .map((p) => ({ ...p }));
      return posts.sort((a, b) => a.published_at.localeCompare(b.published_at));
    },
  };
}
