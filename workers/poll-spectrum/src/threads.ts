/**
 * The thread step (ADR-037): each developer post on the pack read in full from Spectrum's
 * nested-thread endpoint, the call its web app makes for a thread page, without a sign-in. The
 * search (`poll.ts`) gives a post's plain text; the thread gives its own blocks and pictures, and
 * this step writes them as a new revision of the post's `body_html` (append-only, CLAUDE.md
 * section 5; the store revises on a changed body).
 *
 * One request returns the thread's opening post and one page of its replies, nested, centred on
 * `target_reply_id` when one is given (how Spectrum opens a deep link) and on the top of the
 * thread otherwise. A thread's posts on record are read page by page: the first request targets
 * the first reply wanted, each later one the next reply still missing, and the thread is done when
 * every post on record was found or a request found nothing new (a post Spectrum no longer
 * returns is recorded as missing and left with the search's text). Requests to the endpoint are
 * five minutes apart, within a thread and across threads (CLAUDE.md section 9); a non-200 backs
 * off for thirty minutes and tries the same request again, and three in a row end the run.
 *
 * The step is resumable: the pack, the thread state (`fixtures/spectrum/thread-state.json`: which
 * threads were read, which posts found) and the uploads record (`fixtures/spectrum/uploads.json`:
 * every picture's address for `scripts/media/fetch-spectrum.ts`) are saved after each thread, so an
 * interrupted backfill picks up at the next thread due. A post on record whose thread entry does
 * not list it makes its thread due again.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Store } from "poll-news/store";
import type { ContentItem } from "schema";
import { z } from "zod";
import {
  type ContentBlock,
  UnknownBlockError,
  type Upload,
  htmlFromBlocks,
} from "./blocks.js";
import {
  BACKOFF_MS,
  POLL_SPACING_MS,
  type PostLike,
  SPECTRUM_ORIGIN,
  SpectrumStatusError,
} from "./poll.js";

export const THREAD_URL = `${SPECTRUM_ORIGIN}/api/spectrum/forum/thread/nested`;

/** The request the thread page sends: the thread by slug, replies by votes, centred on a reply or the top. */
export function threadBody(slug: string, targetReplyId: string | null): string {
  return JSON.stringify({
    slug,
    sort: "votes",
    target_reply_id: targetReplyId,
  });
}

const str = z.string();
const unixTime = z.number().int().nonnegative();

/** What this step reads of a post in the answer; Spectrum sends far more (votes, reactions, members). */
const PostContent = z
  .object({
    id: str,
    time_created: unixTime,
    time_modified: unixTime.nullable().optional(),
    content_blocks: z.array(z.unknown()).nullable().optional(),
    lexical_content: z.unknown().nullable().optional(),
    is_erased: z.boolean().optional(),
  })
  .loose();

interface ReplyShape extends z.infer<typeof PostContent> {
  thread_id?: string;
  replies?: ReplyShape[];
}

const Reply: z.ZodType<ReplyShape> = PostContent.extend({
  thread_id: str.optional(),
  replies: z.lazy(() => z.array(Reply)).optional(),
}).loose() as unknown as z.ZodType<ReplyShape>;

export const NestedThread = PostContent.extend({
  slug: str,
  subject: str,
  replies_count: z.number().int().nonnegative().optional(),
  replies: z.array(Reply).default([]),
}).loose();
export type NestedThread = z.infer<typeof NestedThread>;

export const ThreadAnswer = z.object({
  success: z.number(),
  data: NestedThread,
});

/** A post in a thread answer, by Spectrum's id (the thread's id for its opening post). */
export interface ThreadPost {
  readonly id: string;
  readonly blocks: readonly unknown[] | null;
  readonly lexical: unknown;
  readonly erased: boolean;
}

/** Every post the answer carries, the opening post first, then the replies in depth-first order. */
export function postsInAnswer(answer: unknown): Map<string, ThreadPost> {
  const parsed = ThreadAnswer.parse(answer);
  if (parsed.success !== 1) {
    throw new Error("Spectrum's thread answer did not succeed");
  }
  const out = new Map<string, ThreadPost>();
  const add = (post: z.infer<typeof PostContent>) => {
    out.set(post.id, {
      id: post.id,
      blocks: post.content_blocks ?? null,
      lexical: post.lexical_content ?? null,
      erased: post.is_erased === true,
    });
  };
  add(parsed.data);
  const walk = (replies: readonly ReplyShape[]) => {
    for (const reply of replies) {
      add(reply);
      if (reply.replies !== undefined) walk(reply.replies);
    }
  };
  walk(parsed.data.replies);
  return out;
}

/** The thread's slug from a post's address: the segment after `/thread/`. */
export function slugOf(url: string): string | null {
  return /\/thread\/([^/?#]+)/.exec(url)?.[1] ?? null;
}

/** One thread's entry in `thread-state.json`. */
export const ThreadState = z.strictObject({
  slug: str,
  read_at: z.iso.datetime({ offset: true }),
  /** Requests made for the thread, all runs counted. */
  requests: z.number().int().nonnegative(),
  /** The posts on record found in the thread's pages. */
  posts: z.array(str),
  /** The posts on record Spectrum's pages did not return; they keep the search's text. */
  missing: z.array(str),
});
export type ThreadState = z.infer<typeof ThreadState>;
export const ThreadStateFile = z.record(str, ThreadState);
export type ThreadStateFile = z.infer<typeof ThreadStateFile>;

/** One row of `uploads.json`: a picture a post carries, for the media fetch. */
export const UploadRow = z.strictObject({
  upload_id: str.regex(/^\d+$/),
  url: z.url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  post_id: str,
  post_url: z.url(),
  thread_id: str,
  seen_at: z.iso.datetime({ offset: true }),
});
export type UploadRow = z.infer<typeof UploadRow>;

export interface JsonFile<T> {
  readonly value: T;
  save(): void;
}

export function openJson<T>(
  path: string,
  schema: z.ZodType<T>,
  empty: T,
): JsonFile<T> {
  const value = existsSync(path)
    ? schema.parse(JSON.parse(readFileSync(path, "utf8")))
    : empty;
  return {
    value,
    save() {
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    },
  };
}

/** A thread with the posts on record in it, newest post first. */
export interface DueThread {
  readonly id: string;
  readonly slug: string;
  readonly posts: readonly ContentItem[];
}

/**
 * The threads whose posts on record have not all been read: every latest, shown Spectrum item
 * grouped by thread, kept where the thread's state lists neither found nor missing for some
 * post; threads with the newest unread post first. `only` narrows it to given post ids (the
 * scheduled run: the posts it just collected).
 */
export function dueThreads(
  items: readonly ContentItem[],
  state: ThreadStateFile,
  only?: ReadonlySet<string>,
): DueThread[] {
  const byThread = new Map<string, ContentItem[]>();
  for (const item of items) {
    if (item.source !== "spectrum" || item.takedown) continue;
    if (item.thread_id === null) continue;
    const list = byThread.get(item.thread_id) ?? [];
    list.push(item);
    byThread.set(item.thread_id, list);
  }
  const due: DueThread[] = [];
  for (const [id, posts] of byThread) {
    const read = state[id];
    const handled = new Set([...(read?.posts ?? []), ...(read?.missing ?? [])]);
    const unread = posts.filter(
      (p) =>
        !handled.has(p.external_id) &&
        (only === undefined || only.has(p.external_id)),
    );
    if (unread.length === 0) continue;
    const sorted = [...posts].sort((a, b) =>
      b.published_at.localeCompare(a.published_at),
    );
    const slug = slugOf(sorted[0]!.url);
    if (slug === null) continue;
    due.push({ id, slug, posts: sorted });
  }
  return due.sort((a, b) =>
    b.posts[0]!.published_at.localeCompare(a.posts[0]!.published_at),
  );
}

export interface ThreadReader {
  /** One request: the thread's page centred on the reply, or its top. Halts on any non-200. */
  read(slug: string, targetReplyId: string | null): Promise<unknown>;
}

export function createThreadReader(options: {
  readonly post: PostLike;
  readonly userAgent: string;
  readonly log?: (event: Record<string, unknown>) => void;
}): ThreadReader {
  const log = options.log ?? (() => undefined);
  const headers = {
    "User-Agent": options.userAgent,
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-Rsi-Token": "",
  };
  return {
    async read(slug, targetReplyId) {
      const response = await options.post(THREAD_URL, {
        headers,
        body: threadBody(slug, targetReplyId),
      });
      if (!response.ok) {
        log({
          event: "spectrum.thread.status",
          status: response.status,
          slug,
          target: targetReplyId,
        });
        throw new SpectrumStatusError(response.status);
      }
      return JSON.parse(await response.text()) as unknown;
    },
  };
}

export interface ReadThreadsOptions {
  readonly store: Store;
  readonly state: JsonFile<ThreadStateFile>;
  readonly uploads: JsonFile<UploadRow[]>;
  readonly reader: ThreadReader;
  readonly due: readonly DueThread[];
  /** How many threads this run reads at most. */
  readonly limit: number;
  readonly now: () => string;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (event: Record<string, unknown>) => void;
  /** The pages one thread may take before its remaining posts are recorded as missing. */
  readonly maxRequestsPerThread?: number;
}

export interface ReadThreadsSummary {
  threads: number;
  requests: number;
  found: number;
  missing: number;
  revised: number;
  unchanged: number;
  uploads: number;
  backoffs: number;
}

/**
 * Reads the due threads, up to the limit, and writes each post's own content as a revision. The
 * pack, the state and the uploads are saved after every thread; a halt (an unknown block, three
 * refusals in a row) leaves the thread in hand unwritten and everything before it saved.
 */
export async function readThreads(
  options: ReadThreadsOptions,
): Promise<ReadThreadsSummary> {
  const log = options.log ?? (() => undefined);
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const maxRequests = options.maxRequestsPerThread ?? 12;
  const summary: ReadThreadsSummary = {
    threads: 0,
    requests: 0,
    found: 0,
    missing: 0,
    revised: 0,
    unchanged: 0,
    uploads: 0,
    backoffs: 0,
  };
  let requested = false;
  let refusals = 0;
  const request = async (
    slug: string,
    target: string | null,
  ): Promise<unknown> => {
    for (;;) {
      // One request every five minutes to the endpoint, whatever the thread.
      if (requested) await sleep(POLL_SPACING_MS);
      requested = true;
      summary.requests += 1;
      try {
        const answer = await options.reader.read(slug, target);
        refusals = 0;
        return answer;
      } catch (error) {
        if (!(error instanceof SpectrumStatusError)) throw error;
        refusals += 1;
        summary.backoffs += 1;
        log({
          event: "spectrum.backoff",
          status: error.status,
          minutes: 30,
          slug,
          attempt: refusals,
        });
        if (refusals >= 3) throw error;
        await sleep(BACKOFF_MS);
      }
    }
  };

  for (const thread of options.due.slice(0, options.limit)) {
    const wanted = new Map(thread.posts.map((p) => [p.external_id, p]));
    const found = new Set<string>();
    const previous = options.state.value[thread.id];
    let requests = 0;
    // The first page is centred on the first reply wanted, the thread's top when the opening
    // post is all that is wanted (it is on every page).
    const nextTarget = (): string | null => {
      const replies = [...wanted.keys()].filter(
        (id) => id !== thread.id && !found.has(id),
      );
      // Oldest first, so a page is as likely as not to carry its neighbours.
      replies.sort((a, b) => Number(a) - Number(b));
      return replies[0] ?? null;
    };
    const pending: {
      item: ContentItem;
      parsed: ReturnType<typeof htmlFromBlocks>;
    }[] = [];
    const seenUploads: Upload[] = [];
    for (;;) {
      const target = nextTarget();
      if (target === null && found.has(thread.id)) break;
      if (target === null && requests > 0 && !wanted.has(thread.id)) break;
      if (requests >= maxRequests) break;
      const answer = await request(thread.slug, target);
      requests += 1;
      const posts = postsInAnswer(answer);
      let gained = 0;
      for (const [id, item] of wanted) {
        if (found.has(id)) continue;
        const post = posts.get(id);
        if (post === undefined) continue;
        found.add(id);
        gained += 1;
        if (post.erased) continue;
        if (post.blocks === null) {
          if (post.lexical !== null) {
            throw new UnknownBlockError(
              `post ${id} has lexical_content and no content_blocks`,
              post.lexical,
            );
          }
          continue;
        }
        const parsed = htmlFromBlocks(post.blocks as ContentBlock[]);
        pending.push({ item, parsed });
        seenUploads.push(...parsed.uploads);
      }
      log({
        event: "spectrum.thread.page",
        thread: thread.id,
        slug: thread.slug,
        target,
        posts_in_answer: posts.size,
        gained,
        found: found.size,
        wanted: wanted.size,
      });
      // A page that brought nothing wanted means the rest is not where Spectrum pages to: stop.
      if (gained === 0) break;
      if (found.size === wanted.size) break;
    }
    // Nothing from the thread is written before the whole of it was read without a halt.
    const now = options.now();
    for (const { item, parsed } of pending) {
      const outcome = options.store.put(
        {
          source: item.source,
          external_id: item.external_id,
          url: item.url,
          title: item.title,
          summary: parsed.first_paragraph ?? item.summary,
          body_html: parsed.html,
          published_at: item.published_at,
          author_id: item.author_id,
          thread_id: item.thread_id,
          thread_title: item.thread_title,
          forum: item.forum,
        },
        now,
      );
      if (outcome === "revised" || outcome === "new") summary.revised += 1;
      else summary.unchanged += 1;
    }
    const byId = new Map(options.uploads.value.map((u) => [u.upload_id, u]));
    for (const { item, parsed } of pending) {
      for (const upload of parsed.uploads) {
        byId.set(upload.id, {
          upload_id: upload.id,
          url: upload.url,
          width: upload.width,
          height: upload.height,
          post_id: item.external_id,
          post_url: item.url,
          thread_id: thread.id,
          seen_at: byId.get(upload.id)?.seen_at ?? now,
        });
      }
    }
    options.uploads.value.splice(
      0,
      options.uploads.value.length,
      ...[...byId.values()].sort(
        (a, b) => Number(a.upload_id) - Number(b.upload_id),
      ),
    );
    const missing = [...wanted.keys()].filter((id) => !found.has(id));
    options.state.value[thread.id] = {
      slug: thread.slug,
      read_at: now,
      requests: (previous?.requests ?? 0) + requests,
      posts: [...new Set([...(previous?.posts ?? []), ...found])].sort(
        (a, b) => Number(a) - Number(b),
      ),
      missing: [
        ...new Set([
          ...(previous?.missing ?? []).filter((id) => !found.has(id)),
          ...missing,
        ]),
      ].sort((a, b) => Number(a) - Number(b)),
    };
    options.store.save();
    options.state.save();
    options.uploads.save();
    summary.threads += 1;
    summary.found += found.size;
    summary.missing += missing.length;
    summary.uploads += seenUploads.length;
    log({
      event: "spectrum.thread.done",
      thread: thread.id,
      slug: thread.slug,
      requests,
      found: found.size,
      missing: missing.length,
      uploads: seenUploads.length,
    });
  }
  return summary;
}
