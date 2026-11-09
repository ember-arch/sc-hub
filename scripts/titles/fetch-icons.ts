/**
 * One-off dev script (CLAUDE.md section 4). Copies each title icon the catalogue names from the
 * wiki's media host into `fixtures/titles-media/` (git-ignored) and records it in
 * `fixtures/titles-media/sources.json` (committed). Local development only (ADR-017):
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/titles/fetch-icons.ts
 *
 * One request per icon, at least 5 seconds apart (the wiki's crawl delay), with the project
 * User-Agent. Icons already copied from the same address are skipped, so a rerun only fetches
 * what changed. `sources.json` is rewritten after every icon, so an interrupted run keeps its work.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TitleCatalog } from "schema";
import { TitlesShapeError } from "./html.js";
import {
  type IconSource,
  IconSources,
  iconsToFetch,
  recordIcon,
} from "./icons.js";
import { USER_AGENT, createPoliteClient } from "./polite.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const catalogFile = join(repoRoot, "fixtures", "titles", "Titles.json");
const outDir = join(repoRoot, "fixtures", "titles-media");
const sourcesFile = join(outDir, "sources.json");
const runId = randomUUID();
const startedAt = Date.now();

function log(event: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
}

async function main(): Promise<void> {
  const catalog = TitleCatalog.parse(
    JSON.parse(readFileSync(catalogFile, "utf8")),
  );
  mkdirSync(outDir, { recursive: true });
  const done: IconSource[] = existsSync(sourcesFile)
    ? IconSources.parse(JSON.parse(readFileSync(sourcesFile, "utf8")))
    : [];
  const todo = iconsToFetch(catalog, done, (file) =>
    existsSync(join(outDir, file)),
  );
  log({
    event: "titles.icons.plan",
    to_fetch: todo.length,
    on_file: done.length,
  });

  const client = createPoliteClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
    log,
  });
  const sources = new Map(done.map((d) => [d.file, d]));
  const save = (): void => {
    const rows = [...sources.values()].sort((a, b) =>
      a.file.localeCompare(b.file, "en"),
    );
    writeFileSync(sourcesFile, `${JSON.stringify(rows, null, 2)}\n`);
  };
  for (const icon of todo) {
    const bytes = await client.bytes(icon.url);
    const row = recordIcon(icon, bytes, new Date().toISOString());
    writeFileSync(join(outDir, icon.file), bytes);
    sources.set(icon.file, row);
    save();
  }
  save();
  log({
    event: "titles.icons.summary",
    requests: client.requests,
    fetched: todo.length,
    on_file: sources.size,
    errors: 0,
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  log({
    event: "titles.icons.failed",
    error: error instanceof Error ? error.message : String(error),
    detail: error instanceof TitlesShapeError ? error.detail : undefined,
    duration_ms: Date.now() - startedAt,
  });
  process.exitCode = 1;
});
