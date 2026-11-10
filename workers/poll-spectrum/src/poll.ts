/**
 * The `poll` implementation (spec 03): Spectrum's own search, the call its web app makes for its
 * search page, asked for the newest original posts and replies highlighted with the community's
 * staff role, read without a sign-in. Every run is two requests to two endpoints: the identify
 * call, which lists the community's roles, and the search; the pages of a backfill are five
 * minutes apart, and any answer that is not a 200 ends the run so the caller backs off to thirty
 * minutes. Both answers are checked against what the app receives (`fixtures/spectrum/samples/`);
 * anything else halts.
 *
 * The staff role is the one Spectrum names "staff" and tracks (id "2", "CIG Staff", the yellow
 * posts); it is resolved each run from the identify answer, and `SPECTRUM_STAFF_ROLE_ID` may
 * override it. A post is a developer post when it carries that highlight: only a holder of a
 * role can highlight with it, so the highlight is the signal, the Wowhead blue post. A staff
 * badge or a handle on `staff.json` counts as well, for a post made without the highlight.
 */
import { z } from "zod";
import type { SpectrumAdapter, StaffPost } from "../adapter.js";
import { type StaffList, isStaff } from "./staff.js";

export const SPECTRUM_ORIGIN = "https://robertsspaceindustries.com";
export const IDENTIFY_URL = `${SPECTRUM_ORIGIN}/api/spectrum/auth/identify`;
export const SEARCH_URL = `${SPECTRUM_ORIGIN}/api/spectrum/search/content/extended`;
export const COMMUNITY_ID = "1";
/** One request every five minutes to an endpoint; thirty after any non-200 (CLAUDE.md section 9). */
export const POLL_SPACING_MS = 5 * 60_000;
export const BACKOFF_MS = 30 * 60_000;
/** The search page's own page size. */
export const PAGE_SIZE = 25;

const str = z.string();
/** The highlight role id: a number on a thread's opening post, a string on a reply. */
const roleId = z.union([z.number(), z.string()]).nullable().optional();

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
    highlight_role_id: roleId,
    is_erased: z.boolean().optional(),
  }),
  details: z.object({
    thread: z.object({
      id: str,
      slug: str,
      subject: str,
      channel_id: str,
      tracked_post_role_id: roleId,
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
  data: z.object({
    hits: z.object({ hits: z.array(Hit), total: z.number().optional() }),
  }),
});

const Role = z
  .object({
    id: str,
    name: str,
    description: str.nullable().optional(),
    tracked: z.boolean().optional(),
  })
  .loose();

export const IdentifyAnswer = z.object({
  success: z.number(),
  data: z.object({
    communities: z.array(
      z.object({ id: str, slug: str, roles: z.array(Role) }).loose(),
    ),
  }),
});

export interface StaffRole {
  readonly id: string;
  /** The label shown as the author's role: the role's description ("CIG Staff"), or its name. */
  readonly label: string;
}

/**
 * The community's staff role from the identify answer: the one role named "staff" that Spectrum
 * tracks. Any other count halts, so a renamed role is noticed rather than polled past.
 */
export function staffRoleOf(answer: unknown): StaffRole {
  const parsed = IdentifyAnswer.parse(answer);
  const community = parsed.data.communities.find((c) => c.id === COMMUNITY_ID);
  if (community === undefined) {
    throw new Error(
      `Spectrum's identify answer has no community ${COMMUNITY_ID}`,
    );
  }
  const staff = community.roles.filter(
    (r) => r.name.toLowerCase() === "staff" && r.tracked === true,
  );
  if (staff.length !== 1) {
    throw new Error(
      `Spectrum names ${staff.length} tracked roles "staff" in community ${community.slug}; expected one`,
    );
  }
  const role = staff[0]!;
  return { id: role.id, label: role.description?.trim() || role.name };
}

export type SearchRange = "day" | "week" | "month" | "year" | "all";

/** The request the search page sends, with the fields its query class names. */
export function searchBody(options: {
  readonly page: number;
  readonly staffRoleId: string;
  readonly range?: SearchRange | undefined;
}): string {
  return JSON.stringify({
    community_id: COMMUNITY_ID,
    type: ["op", "reply"],
    text: "",
    page: options.page,
    sort: "latest",
    range: options.range ?? "week",
    highlight_role_id: Number(options.staffRoleId),
    visibility: "nonerased",
  });
}

/** A hit as a staff post, or null when it is neither highlighted as staff nor by a known member. */
export function postFromHit(
  hit: Hit,
  staff: StaffList,
  role: StaffRole,
): StaffPost | null {
  const member = hit.details.member;
  const highlight = hit._source.highlight_role_id;
  const highlighted =
    highlight !== null &&
    highlight !== undefined &&
    String(highlight) === role.id;
  const badges = (member.meta?.badges ?? []).map((b) => b.name);
  const who = isStaff({ handle: member.nickname, badges }, staff);
  if (!highlighted && !who.staff) return null;
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
      role: highlighted ? role.label : who.role,
    },
  };
}

export type PostLike = (
  url: string,
  init: { headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface PollOptions {
  readonly post: PostLike;
  /** Overrides the role resolved from the identify answer (`SPECTRUM_STAFF_ROLE_ID`). */
  readonly staffRoleId?: string | null;
  readonly staff: StaffList;
  readonly userAgent: string;
  /** How many pages of the newest posts one call reads; a backfill asks for more, five minutes apart. */
  readonly pages?: number;
  /** How far back the search looks; a backfill asks for the year. */
  readonly range?: SearchRange;
  /** Waits between pages; injected so tests need not. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (event: Record<string, unknown>) => void;
}

export function createPollAdapter(options: PollOptions): SpectrumAdapter {
  const log = options.log ?? (() => undefined);
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const headers = {
    "User-Agent": options.userAgent,
    "Content-Type": "application/json",
    // What the web app sends with every call; without a sign-in the token is empty.
    "X-Requested-With": "XMLHttpRequest",
    "X-Rsi-Token": "",
  };
  const call = async (url: string, body: string, page?: number) => {
    const response = await options.post(url, { headers, body });
    if (!response.ok) {
      log({
        event: "spectrum.poll.status",
        status: response.status,
        url,
        page,
      });
      throw new SpectrumStatusError(response.status);
    }
    return JSON.parse(await response.text()) as unknown;
  };
  return {
    async fetchNewStaffPosts(since) {
      // One request to the identify endpoint: the community's roles, and the staff role among them.
      const resolved = staffRoleOf(await call(IDENTIFY_URL, "{}"));
      const role: StaffRole =
        options.staffRoleId === undefined || options.staffRoleId === null
          ? resolved
          : { id: options.staffRoleId, label: resolved.label };
      log({ event: "spectrum.poll.role", id: role.id, label: role.label });
      const posts: StaffPost[] = [];
      const seen = new Set<string>();
      const pages = options.pages ?? 1;
      for (let page = 1; page <= pages; page += 1) {
        // One request every five minutes to the search endpoint (CLAUDE.md section 9).
        if (page > 1) await sleep(POLL_SPACING_MS);
        const answer = SearchAnswer.parse(
          await call(
            SEARCH_URL,
            searchBody({ page, staffRoleId: role.id, range: options.range }),
            page,
          ),
        );
        if (answer.success !== 1) {
          throw new Error(`Spectrum's search did not succeed on page ${page}`);
        }
        const hits = answer.data.hits.hits;
        let older = false;
        for (const hit of hits) {
          if (hit._source.is_erased === true) continue;
          const post = postFromHit(hit, options.staff, role);
          if (post === null || seen.has(post.id)) continue;
          seen.add(post.id);
          const stamp = new Date(post.edited_at ?? post.published_at);
          if (stamp <= since) {
            older = true;
            continue;
          }
          posts.push(post);
        }
        const total = answer.data.hits.total;
        log({ event: "spectrum.poll.page", page, hits: hits.length, total });
        if (older || hits.length === 0) break;
        if (total !== undefined && page * PAGE_SIZE >= total) break;
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
