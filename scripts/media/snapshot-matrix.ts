/**
 * Writes `fixtures/ship-matrix/ConceptShip.json`: RSI's published figures for showcase ships the
 * game does not contain yet (ADR-010). Reads a saved ship-matrix response when given one, or
 * fetches it once (one request).
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/media/snapshot-matrix.ts [saved.json] [fetched-at]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConceptShip } from "schema";
import { z } from "zod";
import { SHOWCASE } from "./showcase.js";
import { RSI_ORIGIN, SHIP_MATRIX_URL } from "./sources.js";
import { rsiUserAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const out = join(repoRoot, "fixtures", "ship-matrix");

const num = z.union([z.number(), z.string(), z.null()]).transform((v) => {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
});
const Row = z
  .object({
    name: z.string(),
    url: z.string(),
    focus: z.string().nullable(),
    size: z.string().nullable(),
    production_status: z.string(),
    length: num,
    beam: num,
    height: num,
    mass: num,
    min_crew: num,
    max_crew: num,
    cargocapacity: num,
    scm_speed: num,
    description: z.string().nullable(),
    manufacturer: z.object({ code: z.string() }),
  })
  .loose();

const saved = process.argv[2];
const raw: unknown =
  saved === undefined
    ? await (
        await fetch(SHIP_MATRIX_URL, {
          headers: {
            "User-Agent": rsiUserAgent("media"),
          },
        })
      ).json()
    : JSON.parse(readFileSync(saved, "utf8"));
const fetchedAt = process.argv[3] ?? new Date().toISOString();
const rows = z.object({ data: z.array(Row) }).parse(raw).data;
const pack = JSON.parse(
  readFileSync(join(repoRoot, "fixtures", "bootstrap", "Vehicle.json"), "utf8"),
) as { slug: string }[];

const concept = SHOWCASE.filter(
  (s) => !pack.some((v) => v.slug === s.slug),
).map((s) => {
  const matches = rows.filter(
    (r) => r.name === s.name && r.manufacturer.code === s.manufacturer_code,
  );
  if (matches.length !== 1)
    throw new Error(`${s.name}: ${matches.length} ship-matrix rows`);
  const r = matches[0]!;
  return ConceptShip.parse({
    slug: s.slug,
    name: r.name,
    manufacturer_code: s.manufacturer_code,
    focus: r.focus,
    size: r.size,
    production_status: r.production_status,
    length_m: r.length,
    beam_m: r.beam,
    height_m: r.height,
    mass_kg: r.mass,
    crew_min: r.min_crew,
    crew_max: r.max_crew,
    cargo_scu: r.cargocapacity,
    scm_speed: r.scm_speed,
    description: (r.description ?? "").trim(),
    page_url: new URL(r.url, RSI_ORIGIN).toString(),
    source: "rsi_ship_matrix",
    fetched_at: fetchedAt,
  });
});
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, "ConceptShip.json"),
  `${JSON.stringify(concept, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    job: "media:snapshot-matrix",
    concept: concept.map((c) => c.slug),
  }),
);
