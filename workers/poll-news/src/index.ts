/**
 * The news pollers (spec 03, ADR-027): one run reads every source and writes what is new to the
 * news pack in `fixtures/news/`. Run from the news workflow every fifteen minutes until the
 * pollers move to Fly; by hand with
 * `pnpm workers:poll-news [--source comm_link|roadmap] [--backfill <pages>]`, where the backfill
 * reads that many pages of the wiki's Comm-Link list, thirty a page, newest first. Logs are JSON
 * lines on stderr; the summary line goes to stdout.
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
  const sources = only === undefined ? ["comm_link", "roadmap"] : [only];
  const backfillPages = Number(flag(args, "--backfill") ?? 0);
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
      write: (next) =>
        writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`),
    };
  };
  const summary: Record<string, unknown> = {
    run_id: runId,
    job: "workers:poll-news",
    sources,
  };
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
      } else {
        throw new Error(`unknown source ${source}`);
      }
    } catch (error) {
      errors += 1;
      log({ event: "news.source.failed", source, error: String(error) });
      summary[source] = { error: String(error) };
    }
  }
  const written = store.save();
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
