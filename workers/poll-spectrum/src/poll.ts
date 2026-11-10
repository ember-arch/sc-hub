/**
 * The `poll` implementation (spec 03): Spectrum's own search, the call its web app makes for its
 * search page, asked for the newest original posts and replies by members of a staff role, with
 * a sanctioned account's session cookie, once every five minutes, backing off to thirty on any
 * answer that is not a 200. The answer's shape is checked against what the app receives
 * (`fixtures/spectrum/samples/`); anything else halts. The role id that names staff differs per
 * community and is read from Spectrum once signed in (`SPECTRUM_STAFF_ROLE_ID`); a post whose
 * author is on `staff.json` counts even when the role filter is not set.
 */
import { z } from "zod";
import type { SpectrumAdapter, StaffPost } from "../adapter.js";
import { type StaffList, isStaff } from "./staff.js";

export const SPECTRUM_ORIGIN = "https://robertsspaceindustries.com";
export const SEARCH_URL = `${SPECTRUM_ORIGIN}/api/spectrum/search/content/extended`;
export const COMMUNITY_ID = "1";
/** One request every five minutes; thirty after any non-200 (CLAUDE.md section 9). */
export const POLL_SPACING_MS = 5 * 60_000;
export const BACKOFF_MS = 30 * 60_000;

const str = z.string();
const Hit = z.object({
  _index: z.string(),
  _id: str,
  _source: z.object({
    subject: str.optional(),
    body: str,
    time_created: str,
    time_modified: str.nullable().optional(),
    member_id: str,
    thread_id: str,
    is_erased: z.boolean().optional(),
  }),
  details: z.object({
    thread: z.object({
      id: str,
      slug: str,
      subject: str,
      channel_id: str,
    }),
    channel: z.object({ id: str, name: str }),
    member: z.object({
      id: str,
      displayname: str,
      nickname: str,
      meta: z
        .object({
          badges: z
            .array(z.object({ name: str }).loose())
            .nullable()
            .optional(),
        })
        .loose()
        .nullable()
        .optional(),
    }),
  }),
});
export type Hit = z.infer<typeof Hit>;

export const SearchAnswer = z.object({
  success: z.number(),
  data: z.object({ hits: z.object({ hits: z.array(Hit) }) }),
});

/** The request the search page sends, as its address spells the filters. */
export function searchBody(options: {
  readonly page: number;
  readonly roleId: string | null;
  readonly sinceRange?: "day" | "week" | "month" | "year" | "all";
}): string {
  return JSON.stringify({
    text: "",
    page: options.page,
    sort: "latest",
    range: options.sinceRange ?? "week",
    scopes: ["op", "reply"],
    community_id: COMMUNITY_ID,
    role_id: options.roleId,
    member_id: null,
    visibility: "nonerased",
  });
}

/** A hit as a staff post, or null when its author is not staff. */
export function postFromHit(hit: Hit, staff: StaffList): StaffPost | null {
  const member = hit.details.member;
  const badges = (member.meta?.badges ?? []).map((b) => b.name);
  const who = isStaff({ handle: member.nickname, badges }, staff);
  if (!who.staff) return null;
  const kind = hit._index.endsWith("_op") ? "op" : "reply";
  const thread = hit.details.thread;
  const base = `${SPECTRUM_ORIGIN}/spectrum/community/SC/forum/${thread.channel_id}/thread/${thread.slug}`;
  const edited = hit._source.time_modified ?? null;
  return {
    id: hit._id,
    kind,
    thread_id: thread.id,
    thread_title: thread.subject,
    forum: hit.details.channel.name,
    url: kind === "op" ? base : `${base}/${hit._id}`,
    body: hit._source.body,
    published_at: new Date(hit._source.time_created).toISOString(),
    edited_at:
      edited === null || edited === hit._source.time_created
        ? null
        : new Date(edited).toISOString(),
    author: {
      handle: member.nickname,
      display_name: member.displayname,
      role: who.role,
    },
  };
}

export type PostLike = (
  url: string,
  init: { headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface PollOptions {
  readonly post: PostLike;
  readonly sessionCookie: string;
  readonly staffRoleId: string | null;
  readonly staff: StaffList;
  readonly userAgent: string;
  /** How many pages of the newest posts one call reads; a backfill asks for more, five minutes apart. */
  readonly pages?: number;
  /** Waits between pages; injected so tests need not. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (event: Record<string, unknown>) => void;
}

export function createPollAdapter(options: PollOptions): SpectrumAdapter {
  const log = options.log ?? (() => undefined);
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  return {
    async fetchNewStaffPosts(since) {
      const posts: StaffPost[] = [];
      const seen = new Set<string>();
      const pages = options.pages ?? 1;
      for (let page = 1; page <= pages; page += 1) {
        // One request every five minutes to the endpoint (CLAUDE.md section 9).
        if (page > 1) await sleep(POLL_SPACING_MS);
        const response = await options.post(SEARCH_URL, {
          headers: {
            "User-Agent": options.userAgent,
            "Content-Type": "application/json",
            Cookie: options.sessionCookie,
          },
          body: searchBody({ page, roleId: options.staffRoleId }),
        });
        if (!response.ok) {
          log({ event: "spectrum.poll.status", status: response.status, page });
          throw new SpectrumStatusError(response.status);
        }
        const answer = SearchAnswer.parse(JSON.parse(await response.text()));
        let older = false;
        for (const hit of answer.data.hits.hits) {
          if (hit._source.is_erased === true) continue;
          const post = postFromHit(hit, options.staff);
          if (post === null || seen.has(post.id)) continue;
          seen.add(post.id);
          const stamp = new Date(post.edited_at ?? post.published_at);
          if (stamp <= since) {
            older = true;
            continue;
          }
          posts.push(post);
        }
        if (older || answer.data.hits.hits.length === 0) break;
      }
      return posts.sort((a, b) => a.published_at.localeCompare(b.published_at));
    },
  };
}

/** A non-200 from Spectrum: the caller backs off to thirty minutes (CLAUDE.md section 9). */
export class SpectrumStatusError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Spectrum answered ${status}`);
    this.name = "SpectrumStatusError";
    this.status = status;
  }
}
