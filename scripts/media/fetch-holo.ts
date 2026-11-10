/**
 * Copies RSI's holoviewer model for every ship (ADR-015, ADR-025) into `fixtures/holo/`
 * (git-ignored) and records where each came from in `fixtures/holo/sources.json`. The addresses
 * come from the store's own listing (`store.ts`): a few pages of one data call, then one request
 * per model, every request at least 5 seconds apart with the project User-Agent and no sign-in.
 * A catalog ship takes the model of the store ship on the pledge page `fetch-rsi.ts` recorded for
 * it; a model two editions share is copied once. A model already on disk from the same address is
 * kept, so a run that stops can carry on; each new file is read once as OpenCTM so a model the
 * decoder cannot read halts the run here, not on the page. The human figure RSI stands beside
 * every ship is copied the same way.
 *
 *   pnpm exec tsx scripts/media/fetch-holo.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readCtm } from "./ctm.js";
import { HOLO_FIGURE } from "./holo.js";
import {
  ConceptSource,
  RSI_SPACING_MS,
  RsiSource,
  createSpacer,
} from "./sources.js";
import {
  type CatalogPage,
  STORE_GRAPHQL_URL,
  STORE_PAGE_SIZE,
  type StoreShip,
  matchModels,
  modelOf,
  parseShipList,
  shipListBody,
} from "./store.js";
import { rsiUserAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, "fixtures", "holo");
/** The store had 256 ships in November 2026; more pages than this is a shape to look at. */
const MAX_PAGES = 40;

export const HoloSourceRow = z.object({
  slug: z.string().min(1),
  file: z.string().min(1),
  url: z.url(),
  page: z.url().nullable(),
  /** The store's own title for the ship, for a reader of the file. */
  store_title: z.string().optional(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  vertices: z.number().int().positive(),
  triangles: z.number().int().positive(),
  fetched_at: z.iso.datetime({ offset: true }),
});
export type HoloSourceRow = z.infer<typeof HoloSourceRow>;

const Vehicle = z.object({ class_name: z.string(), slug: z.string() });

/** Every ship page with a recorded RSI pledge page: entries and editions by class, concepts by slug. */
function catalogPages(): CatalogPage[] {
  const vehicles = z
    .array(Vehicle)
    .parse(
      JSON.parse(
        readFileSync(
          join(repoRoot, "fixtures", "bootstrap", "Vehicle.json"),
          "utf8",
        ),
      ),
    );
  const slugOf = new Map(vehicles.map((v) => [v.class_name, v.slug]));
  const mediaDir = join(repoRoot, "fixtures", "rsi-media");
  const read = <T>(file: string, schema: z.ZodType<T>): T[] => {
    const path = join(mediaDir, file);
    return existsSync(path)
      ? z.array(schema).parse(JSON.parse(readFileSync(path, "utf8")))
      : [];
  };
  const pages: CatalogPage[] = [];
  for (const row of read("sources.json", RsiSource)) {
    const slug = slugOf.get(row.class_name);
    if (slug !== undefined) pages.push({ slug, page_url: row.page_url });
  }
  for (const row of read("concept-sources.json", ConceptSource)) {
    pages.push({ slug: row.slug, page_url: row.page_url });
  }
  return pages;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const log = (event: Record<string, unknown>): void => {
    process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
  };
  mkdirSync(outDir, { recursive: true });
  const sourcesPath = join(outDir, "sources.json");
  const previous: HoloSourceRow[] = existsSync(sourcesPath)
    ? z
        .array(HoloSourceRow)
        .parse(JSON.parse(readFileSync(sourcesPath, "utf8")))
    : [];
  const spacer = createSpacer(
    RSI_SPACING_MS,
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    Date.now,
  );
  const headers = { "User-Agent": rsiUserAgent("media") };

  // The store's listing, a page at a time.
  const store: StoreShip[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    await spacer();
    const response = await fetch(STORE_GRAPHQL_URL, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: shipListBody(page),
    });
    if (!response.ok) {
      throw new Error(
        `${STORE_GRAPHQL_URL} page ${page} returned ${response.status}`,
      );
    }
    const ships = parseShipList(await response.json());
    store.push(...ships);
    log({ event: "holo.store_page", page, ships: ships.length });
    if (ships.length < STORE_PAGE_SIZE) break;
    if (page === MAX_PAGES) {
      throw new Error(`the store listed more than ${MAX_PAGES} pages of ships`);
    }
  }

  const { matched, unmatched, unused } = matchModels(catalogPages(), store);
  for (const miss of unmatched) log({ event: "holo.unmatched", ...miss });
  for (const ship of unused) {
    log({ event: "holo.unused", title: ship.title, url: ship.url });
  }

  // One copy per model file; rows per ship page.
  const rows = new Map<string, HoloSourceRow>();
  const save = (): void =>
    writeFileSync(
      sourcesPath,
      `${JSON.stringify(
        [...rows.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
        null,
        2,
      )}\n`,
    );
  const copied = new Map<
    string,
    Omit<HoloSourceRow, "slug" | "page" | "store_title">
  >();
  let fetched = 0;
  let reused = 0;
  const copy = async (
    url: string,
    file: string,
  ): Promise<Omit<HoloSourceRow, "slug" | "page" | "store_title">> => {
    const done = copied.get(file);
    if (done !== undefined) return done;
    const known = previous.find((r) => r.file === file && r.url === url);
    if (known !== undefined && existsSync(join(outDir, file))) {
      reused += 1;
      const rest = {
        file: known.file,
        url: known.url,
        bytes: known.bytes,
        sha256: known.sha256,
        vertices: known.vertices,
        triangles: known.triangles,
        fetched_at: known.fetched_at,
      };
      copied.set(file, rest);
      return rest;
    }
    await spacer();
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mesh = readCtm(bytes);
    writeFileSync(join(outDir, file), bytes);
    fetched += 1;
    const row = {
      file,
      url,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      vertices: mesh.vertices.length / 3,
      triangles: mesh.indices.length / 3,
      fetched_at: new Date().toISOString(),
    };
    copied.set(file, row);
    log({
      event: "holo.model",
      file,
      bytes: bytes.length,
      triangles: row.triangles,
    });
    return row;
  };

  for (const match of matched) {
    const row = await copy(match.url, match.file);
    rows.set(match.slug, {
      slug: match.slug,
      page: match.page,
      store_title: match.store_title,
      ...row,
    });
    save();
  }
  const figure = await copy(HOLO_FIGURE.url, `${HOLO_FIGURE.slug}.ctm`);
  rows.set(HOLO_FIGURE.slug, { slug: HOLO_FIGURE.slug, page: null, ...figure });
  save();

  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-holo",
      store_ships: store.length,
      store_with_model: store.filter((s) => modelOf(s) !== null).length,
      catalog_pages: matched.length + unmatched.length,
      matched: matched.length,
      unmatched: unmatched.length,
      unused: unused.length,
      files: copied.size,
      fetched,
      reused,
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
    process.stderr.write(
      `${JSON.stringify({ job: "media:fetch-holo", error: String(error) })}\n`,
    );
    process.exitCode = 1;
  });
}
