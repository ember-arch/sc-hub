/**
 * Copies RSI's loaner ship matrix into `fixtures/acquisition/LoanerMatrix.json` (ADR-015): the
 * support article that lists, for every ship not yet flight ready, the ships RSI lends its owners.
 * One request to the help centre's public article API, with the project User-Agent. Writes only
 * when RSI changed the article, so the weekly workflow (`.github/workflows/loaner-matrix.yml`)
 * opens a pull request only for a real change. Halts on a table it does not recognise.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/loaners.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LoanerMatrix, type LoanerRow } from "schema";
import { z } from "zod";
import { rsiUserAgent } from "../user-agent.js";

export const LOANER_ARTICLE_URL =
  "https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix";
export const LOANER_API_URL =
  "https://support.robertsspaceindustries.com/api/v2/help_center/en-us/articles/360003093114.json";

const Article = z.object({
  article: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    edited_at: z.string().min(1),
  }),
});

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

/** A table cell's text: tags dropped, entities decoded, whitespace collapsed. */
export function cellText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&([a-z]+);/gi, (whole, name: string) =>
      Object.hasOwn(ENTITIES, name.toLowerCase())
        ? ENTITIES[name.toLowerCase()]!
        : whole,
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The matrix rows of the article body: every two-cell table row after the "Your ship" header,
 * the loaners split at their commas, repeated rows kept once. A row with another cell count, or a
 * body with no rows, halts the run.
 */
export function parseLoanerRows(body: string): LoanerRow[] {
  const rows: LoanerRow[] = [];
  const seen = new Set<string>();
  for (const tr of body.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (c) => cellText(c[1] ?? ""),
    );
    if (cells.every((c) => c === "")) continue;
    if (cells.length !== 2) {
      throw new Error(
        `loaner matrix: a row with ${cells.length} cells: ${cells.join(" | ")}`,
      );
    }
    const [ships, lent] = cells as [string, string];
    if (/^your ship$/i.test(ships)) continue;
    const loaners = lent
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (ships === "" || loaners.length === 0) {
      throw new Error(`loaner matrix: an incomplete row: ${cells.join(" | ")}`);
    }
    const key = `${ships}|${loaners.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ships, loaners });
  }
  if (rows.length === 0) throw new Error("loaner matrix: no rows found");
  return rows;
}

/** The article's own "Last Updated: <date> | <build>" line, when it has one. */
export function statedUpdate(body: string): {
  date: string | null;
  build: string | null;
} {
  const text = cellText(body);
  const match = /Last Updated:\s*([^|]+?)\s*\|\s*(\d+\.\d+[\w.-]*)/i.exec(text);
  return {
    date: match?.[1]?.trim() ?? null,
    build: match?.[2] ?? null,
  };
}

export function parseLoanerArticle(
  json: unknown,
  fetchedAt: string,
): LoanerMatrix {
  const { article } = Article.parse(json);
  const stated = statedUpdate(article.body);
  return LoanerMatrix.parse({
    article_url: LOANER_ARTICLE_URL,
    api_url: LOANER_API_URL,
    title: article.title,
    edited_at: article.edited_at,
    stated_date: stated.date,
    stated_build: stated.build,
    rows: parseLoanerRows(article.body),
    fetched_at: fetchedAt,
  });
}

/** True when two copies say the same thing; when they were fetched does not count. */
export function sameMatrix(a: LoanerMatrix, b: LoanerMatrix): boolean {
  const content = (m: LoanerMatrix) =>
    JSON.stringify({ ...m, fetched_at: undefined });
  return content(a) === content(b);
}

export type FetchJson = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * One check of the matrix (CLAUDE.md section 6: fetchers take an injected fetch): fetches the
 * article, compares it with the copy on file and returns the copy to write, or null when RSI has
 * not changed it.
 */
export async function checkLoanerMatrix(
  fetchJson: FetchJson,
  previous: LoanerMatrix | null,
  userAgent: string,
  now: () => string,
): Promise<{ next: LoanerMatrix; changed: boolean }> {
  const response = await fetchJson(LOANER_API_URL, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${LOANER_API_URL} returned ${response.status}`);
  }
  const next = parseLoanerArticle(await response.json(), now());
  return { next, changed: previous === null || !sameMatrix(previous, next) };
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "..", "..", "fixtures", "acquisition");
  const file = join(outDir, "LoanerMatrix.json");
  const previous = existsSync(file)
    ? LoanerMatrix.parse(JSON.parse(readFileSync(file, "utf8")))
    : null;
  const { next, changed } = await checkLoanerMatrix(
    (url, init) => globalThis.fetch(url, init),
    previous,
    rsiUserAgent("data"),
    () => new Date().toISOString(),
  );
  if (changed) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "fixtures:loaners",
      in: 1,
      out: next.rows.length,
      changed,
      edited_at: next.edited_at,
      stated_build: next.stated_build,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
