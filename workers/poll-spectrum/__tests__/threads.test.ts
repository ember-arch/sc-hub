import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "poll-news/store";
import type { ContentItem } from "schema";
import { describe, expect, it } from "vitest";
import { UnknownBlockError } from "../src/blocks.js";
import {
  BACKOFF_MS,
  POLL_SPACING_MS,
  SpectrumStatusError,
} from "../src/poll.js";
import {
  THREAD_URL,
  ThreadStateFile,
  UploadRow,
  createThreadReader,
  dueThreads,
  openJson,
  readThreads,
  slugOf,
  threadBody,
} from "../src/threads.js";

// ADR-036: the thread step reads each post's thread in full and writes the post's own content as
// a revision. The fake reader answers with the committed samples; no network here.

const samples = "../../../fixtures/spectrum/samples/";
const read = (name: string) =>
  readFileSync(new URL(`${samples}${name}`, import.meta.url), "utf8");
const redesign = read("thread-nested.sample.json");
const ironclad = read("thread-nested-target.sample.json");

const THREAD =
  "https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/spectrum-redesign-phase-1-now-live";
const AUTHOR = "a0000000-0000-5000-8000-000000000001";

function item(
  id: string,
  publishedAt: string,
  fields: Partial<ContentItem> = {},
): Omit<ContentItem, "id" | "revision" | "fetched_at" | "takedown"> {
  return {
    source: "spectrum",
    external_id: id,
    url: id === "564187" ? THREAD : `${THREAD}/${id}`,
    title: id === "564187" ? "Spectrum Redesign" : "Re: Spectrum Redesign",
    summary: "From the search.",
    body_html: "<p>From the search.</p>",
    published_at: publishedAt,
    author_id: AUTHOR,
    thread_id: "564187",
    thread_title: "Spectrum Redesign: Phase 1 Now Live",
    forum: "Announcements",
    ...fields,
  };
}

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "sc-hub-threads-"));
  const store = openStore(join(dir, "ContentItem.json"));
  const state = openJson(join(dir, "thread-state.json"), ThreadStateFile, {});
  const uploads = openJson(join(dir, "uploads.json"), UploadRow.array(), []);
  return { dir, store, state, uploads };
}

describe("the thread request", () => {
  it("asks for the thread by slug, replies by votes, centred on a reply or the top", () => {
    expect(JSON.parse(threadBody("a-thread", null))).toEqual({
      slug: "a-thread",
      sort: "votes",
      target_reply_id: null,
    });
    expect(JSON.parse(threadBody("a-thread", "9"))).toMatchObject({
      target_reply_id: "9",
    });
    expect(slugOf(`${THREAD}/9048700`)).toBe(
      "spectrum-redesign-phase-1-now-live",
    );
    expect(slugOf(THREAD)).toBe("spectrum-redesign-phase-1-now-live");
    expect(slugOf("https://robertsspaceindustries.com/comm-link/x")).toBeNull();
  });

  it("sends the web app's headers and no cookie, and halts on a non-200", async () => {
    const calls: {
      url: string;
      headers: Record<string, string>;
      body: string;
    }[] = [];
    const reader = createThreadReader({
      post: async (url, init) => {
        calls.push({ url, ...init });
        return { ok: true, status: 200, text: async () => redesign };
      },
      userAgent: "sc-hub-spectrum/0.0 (test)",
    });
    await reader.read("spectrum-redesign-phase-1-now-live", null);
    expect(calls[0]?.url).toBe(THREAD_URL);
    expect(calls[0]?.headers).toEqual({
      "User-Agent": "sc-hub-spectrum/0.0 (test)",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-Rsi-Token": "",
    });
    const down = createThreadReader({
      post: async () => ({ ok: false, status: 503, text: async () => "" }),
      userAgent: "t",
    });
    await expect(down.read("x", null)).rejects.toBeInstanceOf(
      SpectrumStatusError,
    );
  });
});

describe("dueThreads", () => {
  it("groups shown posts by thread, skips threads whose posts were all found or recorded missing, newest first, and narrows to given posts", () => {
    const { store } = workspace();
    const now = "2026-11-10T20:00:00.000Z";
    store.put(item("564187", "2026-07-22T12:00:00.000Z"), now);
    store.put(item("9048700", "2026-07-24T12:00:00.000Z"), now);
    store.put(
      item("8856786", "2026-05-20T12:00:00.000Z", {
        url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/50259/thread/ironclad-assault-4/8856786",
        thread_id: "550304",
        thread_title: "Ironclad/assault",
      }),
      now,
    );
    const items = store.latest();
    const all = dueThreads(items, {});
    expect(all.map((t) => t.id)).toEqual(["564187", "550304"]);
    expect(all[0]?.slug).toBe("spectrum-redesign-phase-1-now-live");
    expect(all[0]?.posts.map((p) => p.external_id)).toEqual([
      "9048700",
      "564187",
    ]);
    const half: ThreadStateFile = {
      "564187": {
        slug: "spectrum-redesign-phase-1-now-live",
        read_at: now,
        requests: 1,
        posts: ["564187"],
        missing: [],
      },
    };
    expect(dueThreads(items, half).map((t) => t.id)).toEqual([
      "564187",
      "550304",
    ]);
    const done: ThreadStateFile = {
      ...half,
      "564187": { ...half["564187"]!, posts: ["564187"], missing: ["9048700"] },
    };
    expect(dueThreads(items, done).map((t) => t.id)).toEqual(["550304"]);
    expect(
      dueThreads(items, {}, new Set(["8856786"])).map((t) => t.id),
    ).toEqual(["550304"]);
    expect(dueThreads(items, {}, new Set())).toEqual([]);
  });
});

describe("readThreads", () => {
  it("reads a thread page by page, five minutes apart, writes each found post's own content as a revision, records the uploads and the state, and leaves a post Spectrum does not return as missing", async () => {
    const { dir, store, state, uploads } = workspace();
    const then = "2026-11-10T20:00:00.000Z";
    store.put(item("564187", "2026-07-22T12:00:00.000Z"), then);
    store.put(item("9048700", "2026-07-24T12:00:00.000Z"), then);
    store.put(item("9999999", "2026-07-25T12:00:00.000Z"), then);
    store.save();
    const targets: (string | null)[] = [];
    const waits: number[] = [];
    const log: Record<string, unknown>[] = [];
    const summary = await readThreads({
      store,
      state,
      uploads,
      reader: {
        read: async (_slug, target) => {
          targets.push(target);
          return JSON.parse(redesign) as unknown;
        },
      },
      due: dueThreads(store.latest(), state.value),
      limit: 10,
      now: () => "2026-11-10T21:00:00.000Z",
      sleep: async (ms) => {
        waits.push(ms);
      },
      log: (e) => log.push(e),
    });
    // The first page is centred on the oldest reply wanted; the second on the one still missing,
    // and it brings nothing new, so the thread ends there.
    expect(targets).toEqual(["9048700", "9999999"]);
    expect(waits).toEqual([POLL_SPACING_MS]);
    expect(summary).toMatchObject({
      threads: 1,
      requests: 2,
      found: 2,
      missing: 1,
      revised: 2,
      unchanged: 0,
      uploads: 3,
      backoffs: 0,
    });
    const op = store.find("spectrum", "564187")!;
    expect(op.revision).toBe(2);
    expect(op.body_html).toMatch(/^<p>Hi everyone,<\/p>/);
    expect(op.body_html).toContain('<img data-upload="3463136"');
    expect(op.summary).toBe("Hi everyone,");
    expect(op.fetched_at).toBe("2026-11-10T21:00:00.000Z");
    // Everything else on the row is as the search wrote it.
    expect(op.url).toBe(THREAD);
    expect(op.author_id).toBe(AUTHOR);
    expect(op.published_at).toBe("2026-07-22T12:00:00.000Z");
    expect(store.find("spectrum", "9999999")!.revision).toBe(1);
    expect(state.value["564187"]).toEqual({
      slug: "spectrum-redesign-phase-1-now-live",
      read_at: "2026-11-10T21:00:00.000Z",
      requests: 2,
      posts: ["564187", "9048700"],
      missing: ["9999999"],
    });
    expect(uploads.value.map((u) => u.upload_id)).toEqual([
      "3463136",
      "3463137",
      "3463138",
    ]);
    expect(uploads.value[0]).toEqual({
      upload_id: "3463136",
      url: "https://theverse.robertsspaceindustries.com/6jyg90p60itm0/source.jpg",
      width: 1680,
      height: 945,
      post_id: "564187",
      post_url: THREAD,
      thread_id: "564187",
      seen_at: "2026-11-10T21:00:00.000Z",
    });
    // Saved to disk after the thread.
    expect(
      ThreadStateFile.parse(
        JSON.parse(readFileSync(join(dir, "thread-state.json"), "utf8")),
      )["564187"]?.posts,
    ).toEqual(["564187", "9048700"]);
    expect(
      (
        JSON.parse(
          readFileSync(join(dir, "ContentItem.json"), "utf8"),
        ) as unknown[]
      ).length,
    ).toBe(5);
    expect(log.map((e) => e["event"])).toEqual([
      "spectrum.thread.page",
      "spectrum.thread.page",
      "spectrum.thread.done",
    ]);
    // Nothing is due any more, and a second run writes nothing.
    const again = await readThreads({
      store,
      state,
      uploads,
      reader: { read: async () => JSON.parse(redesign) as unknown },
      due: dueThreads(store.latest(), state.value),
      limit: 10,
      now: () => "2026-11-10T22:00:00.000Z",
      sleep: async () => undefined,
    });
    expect(again.threads).toBe(0);
  });

  it("asks for the top of the thread when only the opening post is wanted, and leaves an unchanged body alone", async () => {
    const { store, state, uploads } = workspace();
    store.put(
      item("564187", "2026-07-22T12:00:00.000Z"),
      "2026-11-10T20:00:00.000Z",
    );
    const targets: (string | null)[] = [];
    const reader = {
      read: async (_slug: string, target: string | null) => {
        targets.push(target);
        return JSON.parse(redesign) as unknown;
      },
    };
    const first = await readThreads({
      store,
      state,
      uploads,
      reader,
      due: dueThreads(store.latest(), state.value),
      limit: 1,
      now: () => "2026-11-10T21:00:00.000Z",
      sleep: async () => undefined,
    });
    expect(targets).toEqual([null]);
    expect(first.revised).toBe(1);
    // Made due again by hand, the same content is "unchanged": no third revision.
    delete state.value["564187"];
    const second = await readThreads({
      store,
      state,
      uploads,
      reader,
      due: dueThreads(store.latest(), state.value),
      limit: 1,
      now: () => "2026-11-10T22:00:00.000Z",
      sleep: async () => undefined,
    });
    expect(second).toMatchObject({ revised: 0, unchanged: 1 });
    expect(store.find("spectrum", "564187")!.revision).toBe(2);
  });

  it("reads only as many threads as the limit, in due order, and spaces requests across threads", async () => {
    const { store, state, uploads } = workspace();
    const now = "2026-11-10T20:00:00.000Z";
    store.put(item("564187", "2026-07-22T12:00:00.000Z"), now);
    store.put(
      item("8856786", "2026-05-20T12:00:00.000Z", {
        url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/50259/thread/ironclad-assault-4/8856786",
        thread_id: "550304",
        thread_title: "Ironclad/assault",
      }),
      now,
    );
    const slugs: string[] = [];
    const waits: number[] = [];
    const run = (limit: number) =>
      readThreads({
        store,
        state,
        uploads,
        reader: {
          read: async (slug) => {
            slugs.push(slug);
            return JSON.parse(
              slug === "ironclad-assault-4" ? ironclad : redesign,
            ) as unknown;
          },
        },
        due: dueThreads(store.latest(), state.value),
        limit,
        now: () => "2026-11-10T21:00:00.000Z",
        sleep: async (ms) => {
          waits.push(ms);
        },
      });
    expect((await run(1)).threads).toBe(1);
    expect(slugs).toEqual(["spectrum-redesign-phase-1-now-live"]);
    expect((await run(5)).threads).toBe(1);
    expect(slugs).toEqual([
      "spectrum-redesign-phase-1-now-live",
      "ironclad-assault-4",
    ]);
    // Two runs, one request each: a run's first request waits for nothing, so no sleep was needed.
    expect(waits).toEqual([]);
    const reply = store.find("spectrum", "8856786")!;
    expect(reply.body_html).toContain("<ul><li><strong>Armour</strong>");
  });

  it("backs off thirty minutes on a non-200 and asks again, and gives up after three in a row", async () => {
    const { store, state, uploads } = workspace();
    store.put(
      item("564187", "2026-07-22T12:00:00.000Z"),
      "2026-11-10T20:00:00.000Z",
    );
    let calls = 0;
    const waits: number[] = [];
    const events: Record<string, unknown>[] = [];
    const flaky = createThreadReader({
      post: async () => {
        calls += 1;
        return calls === 1
          ? { ok: false, status: 503, text: async () => "" }
          : { ok: true, status: 200, text: async () => redesign };
      },
      userAgent: "t",
    });
    const summary = await readThreads({
      store,
      state,
      uploads,
      reader: flaky,
      due: dueThreads(store.latest(), state.value),
      limit: 1,
      now: () => "2026-11-10T21:00:00.000Z",
      sleep: async (ms) => {
        waits.push(ms);
      },
      log: (e) => events.push(e),
    });
    expect(waits).toEqual([BACKOFF_MS, POLL_SPACING_MS]);
    expect(summary).toMatchObject({ requests: 2, backoffs: 1, revised: 1 });
    expect(events[0]).toMatchObject({
      event: "spectrum.backoff",
      status: 503,
      minutes: 30,
    });

    const { store: s2, state: st2, uploads: u2 } = workspace();
    s2.put(
      item("564187", "2026-07-22T12:00:00.000Z"),
      "2026-11-10T20:00:00.000Z",
    );
    const down = createThreadReader({
      post: async () => ({ ok: false, status: 502, text: async () => "" }),
      userAgent: "t",
    });
    await expect(
      readThreads({
        store: s2,
        state: st2,
        uploads: u2,
        reader: down,
        due: dueThreads(s2.latest(), st2.value),
        limit: 1,
        now: () => "2026-11-10T21:00:00.000Z",
        sleep: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(SpectrumStatusError);
    expect(st2.value).toEqual({});
  });

  it("halts on a post written in the new editor, and on an unknown block, writing nothing for the thread", async () => {
    const { dir, store, state, uploads } = workspace();
    store.put(
      item("564187", "2026-07-22T12:00:00.000Z"),
      "2026-11-10T20:00:00.000Z",
    );
    store.save();
    const lexical = JSON.parse(redesign) as {
      data: { content_blocks: unknown; lexical_content: unknown };
    };
    lexical.data.content_blocks = null;
    lexical.data.lexical_content = { root: { children: [] } };
    await expect(
      readThreads({
        store,
        state,
        uploads,
        reader: { read: async () => lexical },
        due: dueThreads(store.latest(), state.value),
        limit: 1,
        now: () => "2026-11-10T21:00:00.000Z",
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/lexical_content and no content_blocks/);
    const embed = JSON.parse(redesign) as {
      data: { content_blocks: unknown[] };
    };
    embed.data.content_blocks.push({ id: 9, type: "video", data: {} });
    await expect(
      readThreads({
        store,
        state,
        uploads,
        reader: { read: async () => embed },
        due: dueThreads(store.latest(), state.value),
        limit: 1,
        now: () => "2026-11-10T21:00:00.000Z",
        sleep: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(UnknownBlockError);
    expect(store.find("spectrum", "564187")!.revision).toBe(1);
    expect(state.value).toEqual({});
    expect(existsSync(join(dir, "thread-state.json"))).toBe(false);
    expect(
      (
        JSON.parse(
          readFileSync(join(dir, "ContentItem.json"), "utf8"),
        ) as unknown[]
      ).length,
    ).toBe(1);
  });
});
