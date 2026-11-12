/**
 * The events step (ADR-057): reads every event in `fixtures/events/registry.json` from RSI's own
 * schedule page and the FAQ in the news pack, and writes `fixtures/events/<slug>.json` and
 * `fixtures/events/state.json`. Runs in the News workflow after the polls, so the FAQ the
 * Spectrum worker just collected is the one read; also by hand:
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/events/fetch.ts [--force] [--save-samples]
 *
 * RSI is asked only when an event is due (see `run.ts`), one request every 5 seconds with the
 * project User-Agent and the contact address, which it needs: without SC_HUB_CONTACT_EMAIL the
 * step says so and writes nothing. A shape it does not know prints a JSON report on stderr,
 * exits 1 and writes nothing (CLAUDE.md section 5). A record whose data did not change is not
 * rewritten, so its `fetched_at` stays the day the data last changed.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentItem, EventRecord, EventSource } from "schema";
import { sameIgnoringStamps } from "../refresh/plan.js";
import { rsiUserAgent } from "../user-agent.js";
import { EventShapeError } from "./parse.js";
import { EventState, runEvents } from "./run.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const dir = join(repoRoot, "fixtures", "events");
const newsFile = join(repoRoot, "fixtures", "news", "ContentItem.json");
const registryFile = join(dir, "registry.json");
const stateFile = join(dir, "state.json");
const args = process.argv.slice(2);
const runId = randomUUID();
const startedAt = Date.now();

function log(event: Record<string, unknown>): void {
  process.stderr.write(
    `${JSON.stringify({ job: "events", run_id: runId, ...event })}\n`,
  );
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Writes the file only when its data changed, stamps aside (the refresh's rule, ADR-023). */
function writeIfChanged(path: string, text: string): boolean {
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (before !== null && sameIgnoringStamps(before, text)) return false;
  writeFileSync(path, text);
  return true;
}

async function main(): Promise<void> {
  if ((process.env["SC_HUB_CONTACT_EMAIL"] ?? "").trim() === "") {
    // RSI's pages need the contact address (CLAUDE.md section 9); the step stands aside without it.
    log({
      event: "events.skipped",
      reason:
        "SC_HUB_CONTACT_EMAIL is not set; RSI requests carry the contact address",
    });
    return;
  }
  const registry = EventSource.array().parse(
    JSON.parse(readFileSync(registryFile, "utf8")),
  );
  const news = existsSync(newsFile)
    ? ContentItem.array().parse(JSON.parse(readFileSync(newsFile, "utf8")))
    : [];
  const records = new Map<string, EventRecord>();
  for (const source of registry) {
    const file = join(dir, `${source.slug}.json`);
    if (existsSync(file)) {
      records.set(
        source.slug,
        EventRecord.parse(JSON.parse(readFileSync(file, "utf8"))),
      );
    }
  }
  const state = existsSync(stateFile)
    ? EventState.parse(JSON.parse(readFileSync(stateFile, "utf8")))
    : {};
  const out = await runEvents(
    { registry, news, records, state, force: args.includes("--force") },
    {
      fetch: (url, init) => globalThis.fetch(url, init),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => new Date(),
      userAgent: rsiUserAgent("events"),
      log,
    },
  );
  const written: string[] = [];
  for (const [slug, record] of out.records) {
    const path = join(dir, `${slug}.json`);
    if (writeIfChanged(path, json(record))) written.push(`${slug}.json`);
  }
  if (writeIfChanged(stateFile, json(out.state))) written.push("state.json");
  if (args.includes("--save-samples")) {
    const samples = join(dir, "samples");
    mkdirSync(samples, { recursive: true });
    for (const p of out.pages) {
      const id = registry.find((r) => r.slug === p.slug)?.schedule_comm_link;
      writeFileSync(join(samples, `comm-link-${id}.sample.html`), p.page);
      writeFileSync(join(samples, `comm-link-${id}-body.sample.html`), p.body);
    }
  }
  log({
    event: "events.summary",
    events: registry.length,
    requests: out.requests,
    written,
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  log({
    event: "events.halted",
    error: error instanceof Error ? error.message : String(error),
    detail: error instanceof EventShapeError ? error.detail : undefined,
    duration_ms: Date.now() - startedAt,
  });
  process.exitCode = 1;
});
