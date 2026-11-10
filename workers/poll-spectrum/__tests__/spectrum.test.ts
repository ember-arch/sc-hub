import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FeedDocument, createFeedAdapter } from "../src/feed.js";
import {
  IDENTIFY_URL,
  POLL_SPACING_MS,
  SEARCH_URL,
  SearchAnswer,
  SpectrumStatusError,
  createPollAdapter,
  postFromHit,
  searchBody,
  staffRoleOf,
} from "../src/poll.js";
import { STAFF_BADGES, isStaff } from "../src/staff.js";

const samples = "../../../fixtures/spectrum/samples/";
const sample = readFileSync(
  new URL(`${samples}search-extended.sample.json`, import.meta.url),
  "utf8",
);
const identify = readFileSync(
  new URL(`${samples}identify.sample.json`, import.meta.url),
  "utf8",
);
const answer = SearchAnswer.parse(JSON.parse(sample));
const noStaff = { handles: [] };
const staffRole = { id: "2", label: "CIG Staff" };

/** Answers the identify call with the sample and the search with what is given. */
function spectrum(
  search: () => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
  }>,
) {
  return async (url: string) =>
    url === IDENTIFY_URL
      ? { ok: true, status: 200, text: async () => identify }
      : search();
}

describe("isStaff", () => {
  it("counts a staff badge, whole and case aside, or a handle on the list; nothing else", () => {
    expect(
      isStaff({ handle: "x", badges: ["Subscriber", "Staff"] }, noStaff),
    ).toEqual({
      staff: true,
      role: "Staff",
    });
    expect(
      isStaff({ handle: "x", badges: ["community manager"] }, noStaff).role,
    ).toBe("community manager");
    expect(
      isStaff({ handle: "x", badges: ["Staff Sergeant"] }, noStaff).staff,
    ).toBe(false);
    expect(
      isStaff({ handle: "Zyloh-CIG", badges: [] }, { handles: ["zyloh-cig"] }),
    ).toEqual({
      staff: true,
      role: null,
    });
    expect(STAFF_BADGES).toContain("Developer");
  });
});

describe("staffRoleOf", () => {
  it("finds the one tracked role named staff in the identify answer, labelled by its description", () => {
    expect(staffRoleOf(JSON.parse(identify))).toEqual(staffRole);
  });

  it("halts when the community names no such role, or more than one", () => {
    const parsed = JSON.parse(identify) as {
      data: { communities: { roles: { name: string; tracked: boolean }[] }[] };
    };
    const roles = parsed.data.communities[0]!.roles;
    const none = {
      ...parsed,
      data: {
        communities: [
          {
            ...parsed.data.communities[0],
            roles: roles.filter((r) => r.name !== "staff"),
          },
        ],
      },
    };
    expect(() => staffRoleOf(none)).toThrow(/0 tracked roles "staff"/);
    const two = {
      ...parsed,
      data: {
        communities: [
          {
            ...parsed.data.communities[0],
            roles: [...roles, { ...roles[0], id: "99" }],
          },
        ],
      },
    };
    expect(() => staffRoleOf(two)).toThrow(/2 tracked roles "staff"/);
    expect(() =>
      staffRoleOf({ success: 1, data: { communities: [] } }),
    ).toThrow(/no community/);
  });
});

describe("postFromHit", () => {
  it("reads Spectrum's search answer as the app receives it", () => {
    expect(answer.data.hits.hits).toHaveLength(4);
    const [op, reply] = answer.data.hits.hits;
    expect(op?._index).toBe("tavern_forum_thread_op");
    expect(reply?._index).toBe("tavern_forum_thread_reply");
    // The highlight is a number on an opening post and a string on a reply.
    expect(op?._source.highlight_role_id).toBe(2);
    expect(reply?._source.highlight_role_id).toBe("2");
  });

  it("makes a post of every hit highlighted with the staff role, with thread, forum and link", () => {
    const [op, reply] = answer.data.hits.hits;
    const opPost = postFromHit(op!, noStaff, staffRole)!;
    expect(opPost).toMatchObject({
      id: "576588",
      kind: "op",
      thread_id: "576588",
      thread_title:
        "[All Waves] Star Citizen Alpha 4.10.3 PTU Patch Notes 13145606",
      forum: "Patch Notes",
      url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/190048/thread/star-citizen-alpha-4-10-3-ptu-patch-notes-5",
      published_at: "2026-11-09T22:24:26.000Z",
      edited_at: "2026-11-09T22:48:37.000Z",
      author: {
        handle: "Wakapedia-CIG",
        display_name: "Wakapedia-CIG",
        role: "CIG Staff",
      },
    });
    expect(opPost.body).toMatch(/^Alpha Patch 4\.10\.3 has been released/);
    const replyPost = postFromHit(reply!, noStaff, staffRole)!;
    expect(replyPost.kind).toBe("reply");
    expect(replyPost.url).toBe(
      "https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/gdc-armor-change-in-ptu-5-0-unacceptable/9221842",
    );
    expect(replyPost.forum).toBe("General");
    expect(replyPost.author.handle).toBe("Nicou-CIG");
  });

  it("counts the highlight before the badges: a civilian-badged member posting as staff is staff", () => {
    const loujo = answer.data.hits.hits.find(
      (h) => h.details.member.nickname === "LoujoD",
    )!;
    expect(loujo._source.highlight_role_id).toBe("2");
    expect(
      (loujo.details.member.meta?.badges ?? []).map((b) => b.name),
    ).toEqual(["Civilian", "Aurel-Sean Disciples"]);
    const post = postFromHit(loujo, noStaff, staffRole)!;
    expect(post.author).toEqual({
      handle: "LoujoD",
      display_name: "LoujoD_CIG",
      role: "CIG Staff",
    });
  });

  it("makes no post of a hit without the highlight unless its member is badged or listed", () => {
    const [op] = answer.data.hits.hits;
    const plain = {
      ...op!,
      _source: { ...op!._source, highlight_role_id: null },
    };
    // Wakapedia-CIG carries the Developer badge, so the badge still counts.
    expect(postFromHit(plain, noStaff, staffRole)?.author.role).toBe(
      "Developer",
    );
    const unbadged = {
      ...plain,
      details: {
        ...plain.details,
        member: { ...plain.details.member, meta: { badges: [] } },
      },
    };
    expect(postFromHit(unbadged, noStaff, staffRole)).toBeNull();
    expect(
      postFromHit(unbadged, { handles: ["wakapedia-cig"] }, staffRole)?.author
        .role,
    ).toBeNull();
    // Another role's highlight is not staff.
    const mod = {
      ...plain,
      _source: { ...plain._source, highlight_role_id: "3" },
    };
    expect(postFromHit(mod, noStaff, staffRole)?.author.role).toBe("Developer");
  });
});

describe("the poll adapter", () => {
  it("resolves the staff role from the identify call, asks the search with the web app's fields and no cookie, keeps posts newer than since, oldest first", async () => {
    const calls: {
      url: string;
      headers: Record<string, string>;
      body: unknown;
    }[] = [];
    const adapter = createPollAdapter({
      post: async (url, init) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        return url === IDENTIFY_URL
          ? { ok: true, status: 200, text: async () => identify }
          : { ok: true, status: 200, text: async () => sample };
      },
      staff: noStaff,
      userAgent: "sc-hub-spectrum/0.0 (test)",
    });
    const posts = await adapter.fetchNewStaffPosts(
      new Date("2026-11-09T00:00:00Z"),
    );
    expect(calls.map((c) => c.url)).toEqual([IDENTIFY_URL, SEARCH_URL]);
    expect(calls[0]?.body).toEqual({});
    expect(calls[1]?.headers["Cookie"]).toBeUndefined();
    expect(calls[1]?.headers["User-Agent"]).toBe("sc-hub-spectrum/0.0 (test)");
    expect(calls[1]?.body).toEqual({
      community_id: "1",
      type: ["op", "reply"],
      text: "",
      page: 1,
      sort: "latest",
      range: "week",
      highlight_role_id: 2,
      visibility: "nonerased",
    });
    // Silvan-CIG's reply of 2026-11-04 is older than since and left out.
    expect(posts.map((p) => p.id)).toEqual(["9219033", "576588", "9221842"]);
    expect(posts.every((p) => p.author.role === "CIG Staff")).toBe(true);
    const later = await adapter.fetchNewStaffPosts(
      new Date("2026-11-10T15:00:00Z"),
    );
    expect(later).toEqual([]);
  });

  it("takes the role id override and the year range for a backfill", async () => {
    const bodies: unknown[] = [];
    const adapter = createPollAdapter({
      post: async (url, init) => {
        if (url === SEARCH_URL) bodies.push(JSON.parse(init.body));
        return url === IDENTIFY_URL
          ? { ok: true, status: 200, text: async () => identify }
          : { ok: true, status: 200, text: async () => sample };
      },
      staffRoleId: "11",
      staff: noStaff,
      userAgent: "t",
      range: "year",
    });
    // With the role overridden to one the sample's hits do not carry, only the badges count:
    // the three Developer-badged members stay, the civilian-badged one does not.
    const posts = await adapter.fetchNewStaffPosts(new Date(0));
    expect(posts.map((p) => p.author.handle)).toEqual([
      "Silvan-CIG",
      "Wakapedia-CIG",
      "Nicou-CIG",
    ]);
    expect(posts.every((p) => p.author.role === "Developer")).toBe(true);
    expect(bodies[0]).toMatchObject({ highlight_role_id: 11, range: "year" });
    expect(JSON.parse(searchBody({ page: 2, staffRoleId: "2" }))).toMatchObject(
      {
        page: 2,
        highlight_role_id: 2,
        range: "week",
      },
    );
  });

  it("waits five minutes between the pages of a backfill, never repeats a post, and stops at the total", async () => {
    const waits: number[] = [];
    let searches = 0;
    const page = (total: number) =>
      JSON.stringify({
        ...JSON.parse(sample),
        data: { hits: { ...JSON.parse(sample).data.hits, total } },
      });
    const adapter = createPollAdapter({
      post: spectrum(async () => {
        searches += 1;
        return { ok: true, status: 200, text: async () => page(60) };
      }),
      staff: noStaff,
      userAgent: "t",
      pages: 5,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    const posts = await adapter.fetchNewStaffPosts(
      new Date("2026-11-01T00:00:00Z"),
    );
    // Sixty hits at twenty-five a page is three pages; the fourth and fifth are not asked for.
    expect(searches).toBe(3);
    expect(waits).toEqual([POLL_SPACING_MS, POLL_SPACING_MS]);
    expect(posts).toHaveLength(4);
  });

  it("halts on any answer that is not a 200, so the caller backs off", async () => {
    const adapter = createPollAdapter({
      post: spectrum(async () => ({
        ok: false,
        status: 503,
        text: async () => "",
      })),
      staff: noStaff,
      userAgent: "t",
    });
    await expect(
      adapter.fetchNewStaffPosts(new Date(0)),
    ).rejects.toBeInstanceOf(SpectrumStatusError);
    const down = createPollAdapter({
      post: async () => ({ ok: false, status: 502, text: async () => "" }),
      staff: noStaff,
      userAgent: "t",
    });
    await expect(down.fetchNewStaffPosts(new Date(0))).rejects.toBeInstanceOf(
      SpectrumStatusError,
    );
  });

  it("halts on a search that did not succeed, naming Spectrum's code, and on an unknown shape", async () => {
    const answering = (body: unknown) =>
      createPollAdapter({
        post: spectrum(async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(body),
        })),
        staff: noStaff,
        userAgent: "t",
      });
    // The refusal the old body received: a 200 whose answer carries no hits.
    await expect(
      answering({
        success: 0,
        code: "ErrValidationFailed",
        msg: "Validation failed",
        data: { type: "This field is required" },
      }).fetchNewStaffPosts(new Date(0)),
    ).rejects.toThrow(/did not succeed on page 1: ErrValidationFailed/);
    // A success without the hits the parser reads: the shape check halts.
    await expect(
      answering({ success: 1, data: { results: [] } }).fetchNewStaffPosts(
        new Date(0),
      ),
    ).rejects.toThrow(/hits/);
  });
});

describe("the feed adapter", () => {
  it("validates the documented shape and keeps what is newer than since", async () => {
    const doc = {
      version: 1,
      posts: [
        {
          id: "1",
          kind: "op",
          thread_id: "t",
          thread_title: "Thread",
          forum: "Announcements",
          url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/x",
          body: "Hello",
          published_at: "2026-11-01T00:00:00Z",
          edited_at: null,
          author: { handle: "CIG-Dev", display_name: "Dev", role: "Staff" },
        },
      ],
    };
    expect(FeedDocument.parse(doc).posts).toHaveLength(1);
    const adapter = createFeedAdapter({
      url: "https://example.test/feed.json",
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(doc),
      }),
      userAgent: "t",
    });
    expect(
      await adapter.fetchNewStaffPosts(new Date("2026-10-01T00:00:00Z")),
    ).toHaveLength(1);
    expect(
      await adapter.fetchNewStaffPosts(new Date("2026-11-02T00:00:00Z")),
    ).toHaveLength(0);
    expect(() => FeedDocument.parse({ version: 2, posts: [] })).toThrow();
  });
});
