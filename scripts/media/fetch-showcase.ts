/**
 * Copies the showcase ships' official art, videos and 3D models into `fixtures/showcase/<slug>/`
 * (git-ignored) and records each file's source and checksum in `sources.json` there. The story
 * text comes from the ship's Comm-Link as the Star Citizen Wiki API mirrors it, saved verbatim in
 * `article.json`. Polite: one request at a time, 5 s apart for RSI, 2.5 s for everything else; no
 * cookies or signed-in session (ADR-009, ADR-010). Files already present with a recorded checksum
 * are skipped.
 *
 *   pnpm exec tsx scripts/media/fetch-showcase.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHOWCASE } from "./showcase.js";
import { createSpacer } from "./sources.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "fixtures", "showcase");
const USER_AGENT =
  "sc-hub-media/0.0 (non-commercial fan reference in development; github.com/ember-arch/sc-hub)";

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
const spacers = {
  rsi: createSpacer(5_000, sleep, Date.now),
  other: createSpacer(2_500, sleep, Date.now),
};

async function get(url: string): Promise<Response> {
  await (
    url.includes("robertsspaceindustries.com") ? spacers.rsi : spacers.other
  )();
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response;
}

interface Row {
  file: string;
  url: string;
  source: string;
  kind: string;
  bytes: number;
  sha256: string;
  fetched_at: string;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  let fetched = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const ship of SHOWCASE) {
    const dir = join(root, ship.slug);
    mkdirSync(dir, { recursive: true });
    const sourcesPath = join(dir, "sources.json");
    const previous: Row[] = existsSync(sourcesPath)
      ? (JSON.parse(readFileSync(sourcesPath, "utf8")) as Row[])
      : [];
    const rows: Row[] = [];
    for (const item of ship.files) {
      const known = previous.find(
        (r) => r.file === item.file && r.url === item.url,
      );
      if (known !== undefined && existsSync(join(dir, item.file))) {
        rows.push(known);
        skipped += 1;
        continue;
      }
      try {
        const bytes = Buffer.from(await (await get(item.url)).arrayBuffer());
        writeFileSync(join(dir, item.file), bytes);
        rows.push({
          ...item,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          fetched_at: new Date().toISOString(),
        });
        fetched += 1;
      } catch (error) {
        errors.push(`${ship.slug}/${item.file}: ${String(error)}`);
      }
    }
    writeFileSync(sourcesPath, `${JSON.stringify(rows, null, 2)}\n`);
    if (ship.comm_link !== undefined) {
      const articlePath = join(dir, "article.json");
      if (!existsSync(articlePath)) {
        const json = (await (
          await get(
            `https://api.star-citizen.wiki/api/comm-links/${ship.comm_link.id}`,
          )
        ).json()) as {
          data: {
            title: string;
            rsi_url: string;
            created_at: string;
            translations: Record<string, string>;
          };
        };
        writeFileSync(
          articlePath,
          `${JSON.stringify(
            {
              id: ship.comm_link.id,
              title: json.data.title,
              url: json.data.rsi_url,
              published_at: json.data.created_at,
              text: json.data.translations["en_EN"] ?? "",
              via: "api.star-citizen.wiki",
              fetched_at: new Date().toISOString(),
            },
            null,
            2,
          )}\n`,
        );
      }
    }
  }
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-showcase",
      fetched,
      skipped,
      errors,
      duration_ms: Date.now() - started,
    }),
  );
  if (errors.length > 0) process.exitCode = 1;
}

await main();
