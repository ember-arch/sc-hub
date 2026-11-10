/**
 * Copies the standard cargo containers' shapes into `fixtures/cargo/CargoBox.json` (ADR-028):
 * for each container size in SCU, the dimensions the game gives it, read from every cargo item
 * record the Star Citizen Wiki API lists for the pack's build (the commodity containers named
 * `…_1SCU_…`, `…_2SCU_…` and so on), 200 a page through the bootstrap's rate-limited client. A
 * size whose records disagree on the shape, or a shape whose volume does not make its SCU,
 * halts the run and writes nothing.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/cargo-boxes.ts
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CargoBox, CargoBoxes, Manifest } from "schema";
import { z } from "zod";
import { userAgent } from "../user-agent.js";
import { type WikiClient, createWikiClient } from "./fetch.js";

export const CARGO_ITEMS_PATH = "/api/items?filter[type]=Cargo&page[size]=200";

const Dimension = z.looseObject({
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  length: z.number().nullable().optional(),
});

/** The fields of a cargo item record this script reads; everything else passes through. */
export const CargoItemRecord = z.looseObject({
  class_name: z.string().min(1),
  version: z.string().nullable().optional(),
  dimension: z
    .looseObject({ cargo_dimension: Dimension.nullable().optional() })
    .nullable()
    .optional(),
});
export type CargoItemRecord = z.infer<typeof CargoItemRecord>;

export const CargoItemPage = z.looseObject({
  data: z.array(CargoItemRecord),
  meta: z.looseObject({ last_page: z.number().int().positive() }),
});

const SIZE_IN_NAME = /_(\d+)SCU_/i;

/** The container's size in SCU from its class name, or null for a record that is not a standard box. */
export function sizeOf(className: string): number | null {
  const m = SIZE_IN_NAME.exec(className);
  return m === null ? null : Number(m[1]);
}

const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

interface Measured {
  readonly scu: number;
  readonly width: number;
  readonly height: number;
  readonly length: number;
  readonly className: string;
}

/** The record's size and cargo dimensions, the shorter floor side as the width; null where any is missing. */
function measure(r: CargoItemRecord): Measured | null {
  const scu = sizeOf(r.class_name);
  const d = r.dimension?.cargo_dimension;
  const a = d?.width ?? null;
  const height = d?.height ?? null;
  const b = d?.length ?? null;
  if (
    scu === null ||
    a === null ||
    height === null ||
    b === null ||
    a <= 0 ||
    height <= 0 ||
    b <= 0
  )
    return null;
  return {
    scu,
    width: Math.min(a, b),
    height,
    length: Math.max(a, b),
    className: r.class_name,
  };
}

/**
 * One shape per size from the records of the pack's build. Records of another build, without a
 * size in their name or without cargo dimensions are left out and counted as skipped. The cell
 * is the 1 SCU cube's edge, which every cubic 1 SCU record must agree on. A record whose volume
 * is not its SCU of cells (a corpse or a pod named for the slot it takes) is not a standard box
 * and is counted as irregular. Two standard shapes for one size halt the run.
 */
export function collectBoxes(
  records: readonly CargoItemRecord[],
  version: string,
): { rows: CargoBox[]; skipped: number; irregular: number } {
  let skipped = 0;
  const measured: Measured[] = [];
  for (const r of records) {
    const m = r.version === version ? measure(r) : null;
    if (m === null) skipped += 1;
    else measured.push(m);
  }
  const cubes = new Set(
    measured
      .filter(
        (m) =>
          m.scu === 1 && close(m.width, m.height) && close(m.width, m.length),
      )
      .map((m) => m.width),
  );
  if (cubes.size !== 1) {
    throw new Error(
      `the 1 SCU cube's edge must be one value; the records give ${[...cubes].join(", ") || "none"}`,
    );
  }
  const cell = [...cubes][0]!;
  const shapes = new Map<number, CargoBox>();
  let irregular = 0;
  for (const m of measured) {
    const volume = m.width * m.height * m.length;
    if (Math.abs(volume / cell ** 3 - m.scu) > 0.01) {
      irregular += 1;
      continue;
    }
    const seen = shapes.get(m.scu);
    if (seen === undefined) {
      shapes.set(m.scu, {
        scu: m.scu,
        width_m: m.width,
        height_m: m.height,
        length_m: m.length,
        example_class_name: m.className,
        records: 1,
      });
    } else if (
      close(seen.width_m, m.width) &&
      close(seen.height_m, m.height) &&
      close(seen.length_m, m.length)
    ) {
      shapes.set(m.scu, { ...seen, records: seen.records + 1 });
    } else {
      throw new Error(
        `two shapes for a ${m.scu} SCU box: ${seen.example_class_name} is ${seen.width_m} × ${seen.height_m} × ${seen.length_m} m, ${m.className} is ${m.width} × ${m.height} × ${m.length} m`,
      );
    }
  }
  const rows = [...shapes.values()].sort((a, b) => a.scu - b.scu);
  return { rows, skipped, irregular };
}

export async function fetchCargoBoxes(
  client: WikiClient,
  version: string,
  now: () => string,
  log: (event: Record<string, unknown>) => void = () => undefined,
  channel: "LIVE" | "PTU" | "EPTU" = "LIVE",
): Promise<CargoBoxes> {
  const records: CargoItemRecord[] = [];
  for (let page = 1; ; page += 1) {
    const json = await client.getJson(
      `${CARGO_ITEMS_PATH}&page[number]=${page}`,
    );
    const list = CargoItemPage.parse(json);
    records.push(...list.data);
    log({ event: "cargo-boxes.page", page, of: list.meta.last_page });
    if (page >= list.meta.last_page) break;
  }
  const { rows, skipped, irregular } = collectBoxes(records, version);
  log({
    event: "cargo-boxes.collected",
    records: records.length,
    skipped,
    irregular,
  });
  return CargoBoxes.parse({
    channel,
    game_version: version,
    fetched_at: now(),
    source_url: "https://api.star-citizen.wiki/api/items?filter[type]=Cargo",
    via: "star_citizen_wiki_api",
    rows,
  });
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, "..", "..");
  const manifest = Manifest.parse(
    JSON.parse(
      readFileSync(
        join(root, "fixtures", "bootstrap", "manifest.json"),
        "utf8",
      ),
    ),
  );
  const log = (event: Record<string, unknown>): void => {
    process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
  };
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: userAgent("data"),
    log,
  });
  const boxes = await fetchCargoBoxes(
    client,
    manifest.game_version,
    () => new Date().toISOString(),
    log,
    manifest.channel,
  );
  const outDir = join(root, "fixtures", "cargo");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "CargoBox.json"),
    `${JSON.stringify(boxes, null, 2)}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "fixtures:cargo-boxes",
      requests: client.requests,
      out: boxes.rows.length,
      sizes: boxes.rows.map((b) => b.scu),
      game_version: boxes.game_version,
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
