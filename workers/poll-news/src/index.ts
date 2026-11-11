/**
 * The news pollers (spec 03, ADR-027): one run reads every source and writes what is new to the
 * news pack in `fixtures/news/`. Run from the news workflow every thirty minutes until the
 * pollers move to Fly; by hand with `pnpm workers:poll-news [--source comm_link|roadmap|video]`.
 * The YouTube feeds are read on the hour's first run only (ADR-050, `videosDue`). Logs
 * are JSON lines on stderr; the summary line goes to stdout. The Comm-Link archive backfill
 * (`--backfill <pages>`, the wiki's list) is refused since ADR-031: the news window admits
 * nothing before 14 May 2026, the hub carries everything newer, and the wiki's older records
 * carry its import time as their date; `backfillCommLinks` stays for a later window.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "./client.js";
import {
  CommLinkState,
  backfillCommLinks,
  pollCommLinks,
} from "./sources/comm-link.js";
import { BoardState, pollRoadmap } from "./sources/roadmap.js";
import { pollVideos, videosDue } from "./sources/video.js";
import { openStore } from "./store.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const newsDir = join(repoRoot, "fixtures", "news");

function flag(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const args = process.argv.slice(2);
  const only = flag(args, "--source");
  const sources =
    only === undefined
      ? [
          "comm_link",
          "roadmap",
          // Once an hour (CLAUDE.md section 9): the first of the workflow's two runs.
          ...(videosDue(new Date()) ? ["video"] : []),
        ]
      : [only];
  const backfillPages = Number(flag(args, "--backfill") ?? 0);
  if (backfillPages > 0) {
    throw new Error(
      "--backfill is refused (ADR-031): the news window admits nothing before 2026-05-14, the hub lists everything newer, and the wiki's older records carry its import time as their date",
    );
  }
  const log = (event: Record<string, unknown>): void => {
    process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
  };
  const contact = process.env["SC_HUB_CONTACT_EMAIL"]?.trim() || null;
  const client = createClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    contact,
    log,
  });
  const store = openStore(join(newsDir, "ContentItem.json"));
  const now = (): Date => new Date();
  const jsonFile = <T>(
    name: string,
    parse: (raw: unknown) => T,
    empty: T,
  ): { read(): T; write(next: T): void } => {
    const path = join(newsDir, name);
    return {
      read: () =>
        existsSync(path)
          ? parse(JSON.parse(readFileSync(path, "utf8")))
          : empty,
      // Held until the run ends without an error (CLAUDE.md section 5: nothing from a run
      // with an unknown shape goes live, the state beside the pack included).
      write: (next) => {
        pending.set(path, `${JSON.stringify(next, null, 2)}\n`);
      },
    };
  };
  const summary: Record<string, unknown> = {
    run_id: runId,
    job: "workers:poll-news",
    sources,
  };
  const pending = new Map<string, string>();
  let errors = 0;
  for (const source of sources) {
    try {
      if (source === "comm_link") {
        const state = jsonFile(
          "comm-link-state.json",
          (raw) => CommLinkState.parse(raw),
          {},
        );
        summary["comm_link"] = await pollCommLinks(client, store, state, now, {
          log,
        });
        if (backfillPages > 0) {
          summary["comm_link_backfill"] = await backfillCommLinks(
            client,
            store,
            state,
            now,
            backfillPages,
          );
        }
      } else if (source === "roadmap") {
        const state = jsonFile<BoardState | null>(
          "roadmap-state.json",
          (raw) => BoardState.parse(raw),
          null,
        );
        summary["roadmap"] = await pollRoadmap(client, store, state, now);
      } else if (source === "video") {
        summary["video"] = await pollVideos(client, store, now);
      } else {
        throw new Error(`unknown source ${source}`);
      }
    } catch (error) {
      errors += 1;
      log({ event: "news.source.failed", source, error: String(error) });
      summary[source] = { error: String(error) };
    }
  }
  let written = false;
  if (errors === 0) {
    written = store.save();
    for (const [path, text] of pending) writeFileSync(path, text);
  } else {
    log({ event: "news.run.discarded", errors, added: store.added });
  }
  console.log(
    JSON.stringify({
      ...summary,
      items: store.rows.length,
      added: store.added,
      revised: store.revised,
      written,
      requests: client.requests,
      errors,
      duration_ms: Date.now() - started,
    }),
  );
  if (errors > 0) process.exitCode = 2;
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({ job: "workers:poll-news", error: String(error) })}\n`,
    );
    process.exit(1);
  });
}
