/**
 * Writes `fixtures/ship-matrix/ConceptShip.json`: RSI's published figures for every announced
 * ship the game does not contain yet (ADR-010, ADR-022). Reads a saved ship-matrix response when given one, or
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
) as { slug: string; name: string; manufacturer_code: string }[];
// The wiki's record of each pack ship's ship-matrix name (VehicleStats raw), so a ship the
// wiki displays under another name ("MISC Fortune" for "Fortune") is never also a concept.
const matrixNames = new Map<string, string>();
for (const s of JSON.parse(
  readFileSync(
    join(repoRoot, "fixtures", "bootstrap", "VehicleStats.json"),
    "utf8",
  ),
) as { class_name: string; raw?: { shipmatrix_name?: string | null } }[]) {
  const name = s.raw?.shipmatrix_name?.trim();
  if (name !== undefined && name !== "") matrixNames.set(s.class_name, name);
}

// Every announced ship the game does not contain (ADR-022): any row that is not flight ready and
// whose name and maker are not in the pack. A showcase ship keeps its curated slug; the rest take
// the kebab-case name, prefixed by the maker where names collide, and never a slug the pack uses.
const slugify = (name: string): string =>
  name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const inPack = (r: z.infer<typeof Row>): boolean =>
  pack.some(
    (v) =>
      v.manufacturer_code === r.manufacturer.code &&
      (v.name === r.name || [...matrixNames.values()].includes(r.name)),
  );
const candidates = rows.filter(
  (r) => r.production_status !== "flight-ready" && !inPack(r),
);
const taken = new Set(pack.map((v) => v.slug));
const nameCounts = new Map<string, number>();
for (const r of candidates) {
  const base = slugify(r.name);
  nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1);
}
const concept = candidates.map((r) => {
  const curated = SHOWCASE.find(
    (s) => s.name === r.name && s.manufacturer_code === r.manufacturer.code,
  );
  const base = slugify(r.name);
  const slug =
    curated?.slug ??
    ((nameCounts.get(base) ?? 0) > 1 || taken.has(base)
      ? `${slugify(r.manufacturer.code)}-${base}`
      : base);
  if (taken.has(slug) && curated === undefined) {
    throw new Error(`${r.name}: slug ${slug} is already in use`);
  }
  taken.add(slug);
  return ConceptShip.parse({
    slug,
    name: r.name,
    manufacturer_code: r.manufacturer.code,
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
concept.sort((a, b) => a.slug.localeCompare(b.slug));
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
