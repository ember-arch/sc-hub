import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FeedDocument, createFeedAdapter } from "../src/feed.js";
import {
  SEARCH_URL,
  SearchAnswer,
  SpectrumStatusError,
  createPollAdapter,
  postFromHit,
  searchBody,
} from "../src/poll.js";
import { STAFF_BADGES, isStaff } from "../src/staff.js";

const sample = readFileSync(
  new URL(
    "../../../fixtures/spectrum/samples/search-extended.sample.json",
    import.meta.url,
  ),
  "utf8",
);
const answer = SearchAnswer.parse(JSON.parse(sample));
const noStaff = { handles: [] };

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

describe("postFromHit", () => {
  it("reads Spectrum's search answer as the app receives it", () => {
    expect(answer.data.hits.hits).toHaveLength(2);
    const [op, reply] = answer.data.hits.hits;
    expect(op?._index).toBe("tavern_forum_thread_op");
    expect(reply?._index).toBe("tavern_forum_thread_reply");
  });

  it("makes no post of a member without a staff badge, and a post with thread, forum and link of one", () => {
    const [op, reply] = answer.data.hits.hits;
    expect(postFromHit(op!, noStaff)).toBeNull();
    // The reply's author on the hand-kept list: a developer post without a badge.
    const post = postFromHit(reply!, { handles: ["Lujayn"] })!;
    expect(post).toMatchObject({
      id: "9219158",
      kind: "reply",
      thread_id: "576489",
      thread_title: "Changes for the Polaris coming with 4.10.3 and 5.0",
      forum: "Roberts Space Industries",
      url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/65300/thread/changes-for-the-polaris-coming-with-4-10-3-and-5-0/9219158",
      published_at: "2026-11-09T16:43:19.000Z",
      edited_at: null,
      author: { handle: "Lujayn", display_name: "Lujayn", role: null },
    });
    expect(post.body).toMatch(/^The Polaris has been a capital ship/);
    const opPost = postFromHit(op!, { handles: ["Costfanatic06"] })!;
    expect(opPost.kind).toBe("op");
    expect(opPost.url).toBe(
      "https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/the-polaris-the-galaxy-and-the-perseus-oh-my",
    );
  });
});

describe("the poll adapter", () => {
  it("asks Spectrum's search with the session and the staff role, keeps posts newer than since, oldest first", async () => {
    const calls: { url: string; cookie: string; body: unknown }[] = [];
    const adapter = createPollAdapter({
      post: async (url, init) => {
        calls.push({
          url,
          cookie: init.headers["Cookie"]!,
          body: JSON.parse(init.body),
        });
        return { ok: true, status: 200, text: async () => sample };
      },
      sessionCookie: "Rsi-Token=test",
      staffRoleId: "11",
      staff: { handles: ["Lujayn", "Costfanatic06"] },
      userAgent: "sc-hub-spectrum/0.0 (test)",
    });
    const posts = await adapter.fetchNewStaffPosts(
      new Date("2026-11-09T00:00:00Z"),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(SEARCH_URL);
    expect(calls[0]?.cookie).toBe("Rsi-Token=test");
    expect(calls[0]?.body).toMatchObject({
      role_id: "11",
      sort: "latest",
      scopes: ["op", "reply"],
    });
    expect(posts.map((p) => p.id)).toEqual(["9219158", "576637"]);
    const later = await adapter.fetchNewStaffPosts(
      new Date("2026-11-10T07:00:00Z"),
    );
    expect(later).toEqual([]);
    expect(JSON.parse(searchBody({ page: 2, roleId: null }))).toMatchObject({
      page: 2,
      role_id: null,
    });
  });

  it("halts on any answer that is not a 200, so the caller backs off", async () => {
    const adapter = createPollAdapter({
      post: async () => ({ ok: false, status: 503, text: async () => "" }),
      sessionCookie: "x",
      staffRoleId: null,
      staff: noStaff,
      userAgent: "t",
    });
    await expect(
      adapter.fetchNewStaffPosts(new Date(0)),
    ).rejects.toBeInstanceOf(SpectrumStatusError);
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
