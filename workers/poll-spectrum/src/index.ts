/**
 * The Spectrum worker (spec 03, ADR-027): with `SPECTRUM_MODE` `poll` or `feed`, asks the adapter
 * for staff posts since the newest on record and writes them to the news pack as content items
 * of source `spectrum`, with their authors in `fixtures/news/Author.json` (handle, display name,
 * role, first seen, post count; nothing else). With `off`, the default, it does nothing and says
 * so. `pnpm workers:poll-spectrum [--backfill <pages>] [--threads <n>]`: a backfill reads that
 * many pages of the last year, five minutes apart; a plain run reads the newest page of the last
 * week. `poll` mode needs no credential: Spectrum's search answers without a sign-in (ADR-027).
 *
 * After the search, in `poll` mode, the thread step (ADR-036, `threads.ts`) reads each collected
 * post's thread in full and writes the post's own blocks and pictures as a new revision of its
 * `body_html`: a plain run reads the threads of the posts it just collected, up to three; with
 * `--threads <n>` it reads up to n threads due anywhere on the pack, the backfill, which runs
 * locally in the background at one request every five minutes.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paragraphsHtml, firstParagraph } from "poll-news/html";
import { openStore, stableId } from "poll-news/store";
import { Author, NEWS_WINDOW_START, inNewsWindow } from "schema";
import { userAgent } from "schema/site";
import { z } from "zod";
import type { SpectrumAdapter, StaffPost } from "../adapter.js";
import { createFeedAdapter } from "./feed.js";
import { createPollAdapter, SpectrumStatusError } from "./poll.js";
import type { StaffList } from "./staff.js";
import {
  ThreadStateFile,
  UploadRow,
  createThreadReader,
  dueThreads,
  openJson,
  readThreads,
} from "./threads.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const newsDir = join(repoRoot, "fixtures", "news");
const spectrumDir = join(repoRoot, "fixtures", "spectrum");

/**
 * How many threads a scheduled run reads in full after the search (ADR-036): the threads of the
 * posts it just collected, five minutes apart, within the workflow's timeout. The rest wait for
 * the next run, or for `--threads <n>`, which reads up to n threads due across the pack.
 */
export const SCHEDULED_THREADS = 3;
const StaffFile = z.object({ handles: z.array(z.string()) }).loose();

function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

/** The authors file: every CIG staff member seen, by handle. */
export function openAuthors(path: string): {
  readonly rows: Author[];
  /** The author row for a post, made on first sight; the count is not touched. */
  upsert(post: StaffPost, now: string): Author;
  /** One more post on record for this author. */
  count(id: string): void;
  save(): void;
} {
  const rows: Author[] = existsSync(path)
    ? Author.array().parse(JSON.parse(readFileSync(path, "utf8")))
    : [];
  return {
    rows,
    upsert(post, now) {
      const found = rows.find(
        (a) => a.handle.toLowerCase() === post.author.handle.toLowerCase(),
      );
      if (found !== undefined) {
        const next: Author = {
          ...found,
          display_name: post.author.display_name,
          role: post.author.role ?? found.role,
        };
        rows[rows.indexOf(found)] = next;
        return next;
      }
      const author = Author.parse({
        id: stableId(`author:${post.author.handle.toLowerCase()}`),
        handle: post.author.handle,
        display_name: post.author.display_name,
        role: post.author.role,
        first_seen: post.published_at < now ? post.published_at : now,
        post_count: 0,
        takedown: false,
      });
      rows.push(author);
      return author;
    },
    count(id) {
      const at = rows.findIndex((a) => a.id === id);
      const row = rows[at];
      if (row !== undefined)
        rows[at] = { ...row, post_count: row.post_count + 1 };
    },
    save() {
      writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
    },
  };
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const args = process.argv.slice(2);
  const log = (event: Record<string, unknown>): void => {
    process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
  };
  // An unset repository variable reaches a workflow step as the empty string: that is off too.
  const mode = process.env["SPECTRUM_MODE"] || "off";
  const contact = process.env["SC_HUB_CONTACT_EMAIL"]?.trim() || null;
  if (mode === "off") {
    console.log(
      JSON.stringify({
        run_id: runId,
        job: "workers:poll-spectrum",
        mode,
        note: "SPECTRUM_MODE is off: nothing read, nothing written",
        duration_ms: Date.now() - started,
      }),
    );
    return;
  }
  if (contact === null) {
    throw new Error(
      "Set SC_HUB_CONTACT_EMAIL: CLAUDE.md section 9 asks RSI requests to carry a contact address.",
    );
  }
  const staff: StaffList = StaffFile.parse(
    JSON.parse(readFileSync(join(here, "..", "staff.json"), "utf8")),
  );
  let adapter: SpectrumAdapter;
  const backfill = flag(args, "--backfill");
  if (mode === "poll") {
    // The staff role is resolved from Spectrum each run; the variable only overrides it.
    const roleId = process.env["SPECTRUM_STAFF_ROLE_ID"] || null;
    adapter = createPollAdapter({
      post: (url, init) =>
        globalThis.fetch(url, {
          method: "POST",
          headers: init.headers,
          body: init.body,
        }),
      staffRoleId: roleId,
      staff,
      userAgent: userAgent("poll-spectrum", contact),
      pages: Number(backfill ?? 1),
      range: backfill === undefined ? "week" : "year",
      log,
    });
  } else if (mode === "feed") {
    const url = process.env["SPECTRUM_FEED_URL"] || undefined;
    if (url === undefined)
      throw new Error("SPECTRUM_MODE=feed needs SPECTRUM_FEED_URL");
    adapter = createFeedAdapter({
      url,
      fetch: (u, init) => globalThis.fetch(u, init),
      userAgent: userAgent("poll-spectrum", contact),
    });
  } else {
    throw new Error(`SPECTRUM_MODE must be off, poll or feed; got ${mode}`);
  }

  const store = openStore(join(newsDir, "ContentItem.json"));
  const authors = openAuthors(join(newsDir, "Author.json"));
  const newest = store
    .latest()
    .filter((i) => i.source === "spectrum")
    .map((i) => i.published_at)
    .sort()
    .at(-1);
  // The first run reads back to the news window (ADR-031), later runs from the newest on record.
  const since = new Date(newest ?? NEWS_WINDOW_START);
  const now = new Date().toISOString();
  let posts: readonly StaffPost[];
  try {
    posts = await adapter.fetchNewStaffPosts(since);
  } catch (error) {
    if (error instanceof SpectrumStatusError) {
      log({ event: "spectrum.backoff", status: error.status, minutes: 30 });
    }
    throw error;
  }
  let older = 0;
  const collected = new Set<string>();
  for (const post of posts) {
    // Before the author row: a post from before the news window (ADR-031) makes no author
    // and no item (an old post edited this week comes back from the search with its old time).
    if (!inNewsWindow(post.published_at)) {
      older += 1;
      continue;
    }
    const author = authors.upsert(post, now);
    const outcome = store.put(
      {
        source: "spectrum",
        external_id: post.id,
        url: post.url,
        title:
          post.kind === "op" ? post.thread_title : `Re: ${post.thread_title}`,
        summary: firstParagraph(post.body),
        body_html: paragraphsHtml(post.body),
        published_at: post.published_at,
        author_id: author.id,
        thread_id: post.thread_id,
        thread_title: post.thread_title,
        forum: post.forum,
      },
      now,
    );
    if (outcome === "new") authors.count(author.id);
    if (outcome === "new" || outcome === "revised") collected.add(post.id);
  }
  const written = store.save();
  if (written) authors.save();

  // The thread step (ADR-036): the posts' own blocks and pictures, in poll mode only (a feed
  // from CIG would carry them itself).
  const threadsFlag = flag(args, "--threads");
  let threads = null;
  if (mode === "poll") {
    const state = openJson(
      join(spectrumDir, "thread-state.json"),
      ThreadStateFile,
      {},
    );
    const uploads = openJson(
      join(spectrumDir, "uploads.json"),
      UploadRow.array(),
      [],
    );
    const due =
      threadsFlag === undefined
        ? dueThreads(store.latest(), state.value, collected)
        : dueThreads(store.latest(), state.value);
    const limit =
      threadsFlag === undefined ? SCHEDULED_THREADS : Number(threadsFlag);
    log({ event: "spectrum.threads.due", due: due.length, limit });
    threads = await readThreads({
      store,
      state,
      uploads,
      reader: createThreadReader({
        post: (url, init) =>
          globalThis.fetch(url, {
            method: "POST",
            headers: init.headers,
            body: init.body,
          }),
        userAgent: userAgent(contact),
        log,
      }),
      due,
      limit,
      now: () => new Date().toISOString(),
      log,
    });
  }
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "workers:poll-spectrum",
      mode,
      since: since.toISOString(),
      posts: posts.length,
      older,
      added: store.added,
      revised: store.revised,
      authors: authors.rows.length,
      written,
      threads,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({ job: "workers:poll-spectrum", error: String(error) })}\n`,
    );
    process.exit(1);
  });
}
