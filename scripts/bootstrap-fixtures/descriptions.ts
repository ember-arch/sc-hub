/**
 * Ship descriptions for the cinematic ship page concept (ADR-008): CIG's own in-game text for
 * each ship in the bootstrap pack, from the game localization as the Star Citizen Wiki API
 * serves it (`game_description.en_EN`, falling back to the ship-matrix `description.en_EN`).
 * Nothing here is written by hand: the text is copied, only a leading block of "Key: value"
 * header lines (manufacturer, focus) is dropped because the page shows those facts already.
 *
 * Reads the wiki uuid of each ship from the pack's VehicleStats `raw`, so it needs one request per
 * ship through the same polite client as the bootstrap (one request every 2.5 s). A response for a
 * different game version than the pack halts the run rather than mixing versions.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/descriptions.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createWikiClient } from "./fetch.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const packDir = join(repoRoot, "fixtures", "bootstrap");
const outDir = join(repoRoot, "fixtures", "descriptions");

const USER_AGENT =
  "sc-hub-bootstrap/0.0 (non-commercial fan reference; github.com/ember-arch/sc-hub)";

const Localized = z.record(z.string(), z.string()).nullable().optional();
const WikiVehicle = z.object({
  data: z.object({
    class_name: z.string(),
    version: z.string(),
    game_description: Localized,
    description: Localized,
  }),
});

const Manifest = z.object({ channel: z.string(), game_version: z.string() });
const StatsRow = z.object({
  class_name: z.string(),
  raw: z.object({ uuid: z.string() }).loose(),
});

/** Drops a leading "Manufacturer: X / Focus: Y" block; the rest is CIG's text as served. */
export function cleanDescription(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  let start = 0;
  while (
    start < lines.length &&
    /^[^:\n]{1,40}:\s.+$/.test(lines[start] ?? "")
  ) {
    start += 1;
  }
  while (start < lines.length && (lines[start] ?? "").trim() === "") start += 1;
  return lines.slice(start).join("\n").trim();
}

async function main(): Promise<void> {
  const manifest = Manifest.parse(
    JSON.parse(readFileSync(join(packDir, "manifest.json"), "utf8")),
  );
  const stats = z
    .array(StatsRow)
    .parse(
      JSON.parse(readFileSync(join(packDir, "VehicleStats.json"), "utf8")),
    );
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
  });
  const fetchedAt = new Date().toISOString();
  const rows = [];
  for (const row of [...stats].sort((a, b) =>
    a.class_name.localeCompare(b.class_name),
  )) {
    const json = WikiVehicle.parse(
      await client.getJson(`/api/vehicles/${encodeURIComponent(row.raw.uuid)}`),
    ).data;
    if (json.class_name !== row.class_name) {
      throw new Error(
        `wiki uuid ${row.raw.uuid} is ${json.class_name}, the pack says ${row.class_name}`,
      );
    }
    if (json.version !== manifest.game_version) {
      throw new Error(
        `${row.class_name}: the API serves ${json.version}, the pack is ${manifest.game_version}; regenerate the pack first`,
      );
    }
    const fromGame = json.game_description?.["en_EN"];
    const fromMatrix = json.description?.["en_EN"];
    const source =
      fromGame !== undefined && fromGame.trim() !== ""
        ? "localization"
        : "ship_matrix";
    const text = cleanDescription(
      source === "localization" ? (fromGame ?? "") : (fromMatrix ?? ""),
    );
    if (text === "") continue;
    rows.push({
      class_name: row.class_name,
      channel: manifest.channel,
      game_version: manifest.game_version,
      text,
      source,
      fetched_at: fetchedAt,
    });
    console.log(
      JSON.stringify({
        event: "descriptions.ship",
        class_name: row.class_name,
        source,
        chars: text.length,
      }),
    );
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "VehicleDescription.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify({
      event: "descriptions.done",
      rows: rows.length,
      requests: client.requests,
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
