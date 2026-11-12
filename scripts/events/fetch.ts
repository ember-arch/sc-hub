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
 * step says so and writes nothing. A show whose page or FAQ has a shape this does not know keeps
 * its record as it was (CLAUDE.md section 5): the report goes to stderr and, in CI, an error on
 * the run; the state file still records the phase, so the day turns on the site; the step exits 1
 * after writing. A record whose data did not change is not rewritten, so its `fetched_at` stays
 * the day the data last changed. A show whose schedule Comm-Link is under takedown is removed.
 */
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

/** An error on the GitHub Actions run, which a step with continue-on-error would otherwise hide. */
function annotate(message: string): void {
  if (process.env["GITHUB_ACTIONS"] !== "true") return;
  const text = message.replace(/%/g, "%25").replace(/\r?\n/g, " ");
  process.stdout.write(`::error title=The shows' step::${text}\n`);
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
  for (const slug of out.removed) {
    const path = join(dir, `${slug}.json`);
    if (existsSync(path)) {
      rmSync(path);
      written.push(`${slug}.json (removed: takedown)`);
    }
  }
  if (writeIfChanged(stateFile, json(out.state))) written.push("state.json");
  // The pages are kept even when parsing them failed: they are what a fix is written against.
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
    failures: out.failures.length,
    duration_ms: Date.now() - startedAt,
  });
  for (const f of out.failures) {
    log({ event: "events.halted", ...f });
    annotate(`${f.slug}: the ${f.part} could not be read: ${f.error}`);
  }
  if (out.failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log({
    event: "events.halted",
    error: message,
    detail: error instanceof EventShapeError ? error.detail : undefined,
    duration_ms: Date.now() - startedAt,
  });
  annotate(message);
  process.exitCode = 1;
});
