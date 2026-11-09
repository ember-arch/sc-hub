/**
 * One-off dev script (CLAUDE.md section 4: nothing in scripts/ runs in production). Copies the
 * titles from the Star Citizen Wiki's "Titles" article into `fixtures/titles/` (ADR-017):
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/titles/fetch.ts
 *
 * One request for the rendered article (the wiki's robots.txt rules out its API), with the
 * project User-Agent. The parser halts on any shape it does not know and the catalogue is
 * validated against `TitleCatalog`; any problem prints a JSON report on stderr, exits 1 and
 * writes nothing.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TitleCatalog } from "schema";
import { TitlesShapeError } from "./html.js";
import { ARTICLE_URL, parseTitlesArticle, removedSlugs } from "./parse.js";
import { USER_AGENT, createPoliteClient } from "./polite.js";
import { trimArticle } from "./sample.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, "fixtures", "titles");
const runId = randomUUID();
const startedAt = Date.now();

function log(event: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
}

async function main(): Promise<void> {
  const client = createPoliteClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
    log,
  });
  const html = await client.text(ARTICLE_URL);
  const fetchedAt = new Date().toISOString();
  const article = parseTitlesArticle(html);

  // Slugs are addresses: refuse to drop one unless TITLES_ACCEPT_REMOVED lists exactly those dropped.
  const catalogFile = join(outDir, "Titles.json");
  if (existsSync(catalogFile)) {
    const previous = TitleCatalog.parse(
      JSON.parse(readFileSync(catalogFile, "utf8")),
    );
    const removed = removedSlugs(previous.titles, article.titles);
    const accepted = (process.env["TITLES_ACCEPT_REMOVED"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    if (
      removed.length > 0 &&
      removed.slice().sort().join(",") !== accepted.join(",")
    ) {
      throw new TitlesShapeError(
        "titles would disappear; if the wiki renamed or removed them on purpose, rerun with TITLES_ACCEPT_REMOVED set to this list",
        { removed: removed.join(",") },
      );
    }
  }
  const catalog = TitleCatalog.parse({
    source: {
      article_url: ARTICLE_URL,
      revision_id: article.revisionId,
      revision_url: `https://starcitizen.tools/index.php?title=Titles&oldid=${article.revisionId}`,
      edited_at: article.editedAt,
      fetched_at: fetchedAt,
      licence: {
        name: "CC BY-SA 4.0",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
    },
    lead: article.lead,
    groups: article.groups,
    titles: article.titles,
  });

  mkdirSync(join(outDir, "samples"), { recursive: true });
  writeFileSync(
    join(outDir, "Titles.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  writeFileSync(
    join(outDir, "samples", "Titles.sample.html"),
    trimArticle(html),
  );

  const perGroup: Record<string, number> = {};
  for (const t of catalog.titles)
    perGroup[t.group] = (perGroup[t.group] ?? 0) + 1;
  log({
    event: "titles.fetch.summary",
    requests: client.requests,
    revision_id: catalog.source.revision_id,
    titles: catalog.titles.length,
    per_group: perGroup,
    icons: new Set(catalog.titles.flatMap((t) => (t.icon ? [t.icon.url] : [])))
      .size,
    errors: 0,
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  log({
    event: "titles.fetch.failed",
    error: error instanceof Error ? error.message : String(error),
    kind: error instanceof Error ? error.name : "unknown",
    detail: error instanceof TitlesShapeError ? error.detail : undefined,
    issues:
      error !== null && typeof error === "object" && "issues" in error
        ? (error as { issues: unknown }).issues
        : undefined,
    duration_ms: Date.now() - startedAt,
  });
  process.exitCode = 1;
});
