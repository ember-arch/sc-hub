/**
 * One-off dev script (CLAUDE.md section 4). Copies RSI's funding and citizen counters, one
 * snapshot a day, from the Star Citizen Wiki API into `fixtures/funding/Funding.json` (ADR-018):
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/funding/fetch.ts
 *
 * About 21 requests of 200 rows through the bootstrap's rate-limited client (30 a minute at
 * most), with the project User-Agent. A row of an unknown shape halts the run with a JSON report
 * on stderr and nothing is written. The first 200 rows are also kept as a committed sample for
 * the mapper's unit tests.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FundingSeries } from "schema";
import { createWikiClient } from "../bootstrap-fixtures/fetch.js";
import { userAgent } from "../user-agent.js";
import {
  WikiStatsPage,
  type WikiStatsRow,
  dropImplausible,
  findGaps,
  mapSnapshots,
} from "./map.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, "fixtures", "funding");
const runId = randomUUID();
const startedAt = Date.now();

export const STATS_PATH = "/api/v2/stats";
export const ORIGIN_URL = "https://robertsspaceindustries.com/funding-goals";
const PAGE_SIZE = 200;

function log(event: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
}

async function main(): Promise<void> {
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: userAgent("funding"),
    log,
  });
  const rows: WikiStatsRow[] = [];
  let sample: unknown = null;
  for (let page = 1; ; page += 1) {
    const path = `${STATS_PATH}?page%5Bsize%5D=${PAGE_SIZE}&page%5Bnumber%5D=${page}`;
    const json = await client.getJson(path);
    if (page === 1) sample = json;
    const parsed = WikiStatsPage.parse(json);
    if (parsed.meta.current_page !== page) {
      throw new Error(
        `asked for page ${page}, got ${parsed.meta.current_page}`,
      );
    }
    rows.push(...parsed.data);
    if (page >= parsed.meta.last_page) break;
  }
  const { kept: snapshots, dropped } = dropImplausible(mapSnapshots(rows));
  const series = FundingSeries.parse({
    source: {
      name: "Star Citizen Wiki API",
      url: `https://api.star-citizen.wiki${STATS_PATH}`,
      origin_url: ORIGIN_URL,
      fetched_at: new Date().toISOString(),
      dropped,
      gaps: findGaps(snapshots),
    },
    snapshots,
  });
  mkdirSync(join(outDir, "samples"), { recursive: true });
  writeFileSync(
    join(outDir, "Funding.json"),
    `${JSON.stringify(series, null, 2)}\n`,
  );
  writeFileSync(
    join(outDir, "samples", "stats-page-1.json"),
    `${JSON.stringify(sample, null, 2)}\n`,
  );
  log({
    event: "funding.fetch.summary",
    requests: client.requests,
    rows_in: rows.length,
    snapshots: snapshots.length,
    dropped: dropped.length,
    first_day: snapshots[0]?.day,
    last_day: snapshots.at(-1)?.day,
    gaps: series.source.gaps.length,
    errors: 0,
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  log({
    event: "funding.fetch.failed",
    error: error instanceof Error ? error.message : String(error),
    issues:
      error !== null && typeof error === "object" && "issues" in error
        ? (error as { issues: unknown }).issues
        : undefined,
    duration_ms: Date.now() - startedAt,
  });
  process.exitCode = 1;
});
