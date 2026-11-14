/**
 * Reads RSI's own funding counters (ADR-018, amended 2026-11-13) into
 * `fixtures/funding/Counter.json`: one POST to the endpoint RSI's funding page reads, with the
 * project User-Agent and the contact address, which it needs (without SC_HUB_CONTACT_EMAIL it says
 * so and writes nothing). Runs in the News workflow just before the commit; also by hand:
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/funding/counter.ts [--when-due] [--save-sample]
 *
 * `--when-due` asks RSI nothing while the committed reading is under COUNTER_EVERY_MS old; the
 * workflow passes it on a run that has nothing else to commit, so the counter alone redeploys the
 * site at most about once an hour. It waits five seconds first, since the same job's polls have
 * just asked RSI (CLAUDE.md section 9). An answer of an unknown shape, or a reading below half the
 * latest daily snapshot, halts the run with a JSON report on stderr (and, in CI, an error on the
 * run's page) and nothing is written.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FundingCounter, FundingSeries } from "schema";
import { rsiUserAgent } from "../user-agent.js";
import { counterDue, readCounter } from "./counter-map.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, "fixtures", "funding");
const COUNTER_FILE = join(outDir, "Counter.json");
const SERIES_FILE = join(outDir, "Funding.json");
const SAMPLE_FILE = join(outDir, "samples", "crowdfund-stats.json");

const runId = randomUUID();
const startedAt = Date.now();
const args = new Set(process.argv.slice(2));

function log(event: Record<string, unknown>): void {
  process.stderr.write(
    `${JSON.stringify({ job: "funding-counter", run_id: runId, ...event })}\n`,
  );
}

/** In CI, a failure goes on the run's page too: the step does not fail the run (ADR-018, amended). */
function annotate(text: string): void {
  if (process.env["GITHUB_ACTIONS"] !== "true") return;
  process.stdout.write(
    `::error title=RSI's funding counter::${text.replace(/\r?\n/g, " ")}\n`,
  );
}

function readJson(file: string): unknown {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

async function main(): Promise<void> {
  const previousJson = readJson(COUNTER_FILE);
  const previous =
    previousJson === null ? null : FundingCounter.parse(previousJson);
  if (args.has("--when-due") && !counterDue(previous, new Date())) {
    log({
      event: "funding.counter.not_due",
      read_at: previous?.read_at,
      duration_ms: Date.now() - startedAt,
    });
    return;
  }
  if ((process.env["SC_HUB_CONTACT_EMAIL"] ?? "").trim() === "") {
    log({
      event: "funding.counter.skipped",
      reason:
        "SC_HUB_CONTACT_EMAIL is not set; RSI requests carry the contact address",
    });
    return;
  }
  const seriesJson = readJson(SERIES_FILE);
  const latest =
    seriesJson === null
      ? null
      : (FundingSeries.parse(seriesJson).snapshots.at(-1) ?? null);
  const { counter, answer } = await readCounter(previous, latest, {
    fetch: (url, init) => globalThis.fetch(url, init),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => new Date(),
    userAgent: rsiUserAgent("funding"),
  });
  FundingCounter.parse(counter);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(COUNTER_FILE, `${JSON.stringify(counter, null, 2)}\n`);
  if (args.has("--save-sample")) {
    mkdirSync(dirname(SAMPLE_FILE), { recursive: true });
    writeFileSync(SAMPLE_FILE, `${JSON.stringify(answer, null, 2)}\n`);
  }
  log({
    event: "funding.counter.summary",
    requests: 1,
    read_at: counter.read_at,
    funds_usd: counter.funds_usd,
    citizens: counter.citizens,
    previous_read_at: previous?.read_at,
    previous_day: counter.previous_day?.read_at ?? null,
    errors: 0,
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log({
    event: "funding.counter.failed",
    error: message,
    issues:
      error !== null && typeof error === "object" && "issues" in error
        ? (error as { issues: unknown }).issues
        : undefined,
    duration_ms: Date.now() - startedAt,
  });
  annotate(
    `${message}. Nothing was written; the front page keeps the reading on file.`,
  );
  process.exitCode = 1;
});
