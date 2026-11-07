import {
  type DataPack,
  type Entity,
  type EntityName,
  type GameVersion,
  type Item,
  type ItemStats,
  type Manifest,
  type Manufacturer,
  type Port,
  type Vehicle,
  type VehicleStats,
  parsePack,
  primaryKeyOf,
  sha256Hex,
  utf8Bytes,
} from "schema";
import { ITEM_RAW_DROP, VEHICLE_RAW_DROP, collapseLocales } from "./map.js";

/**
 * Turns mapped rows into the files of a data pack, validates the result with the same parser the
 * seed and the import job use, and enforces the acceptance criterion's limits. Pure: nothing here
 * touches the network or the disk.
 */

/** Verbatim from docs/legal/attribution.md; packages/ui/legal.ts will hold it once that exists. */
export const WIKI_CREDIT_LINE =
  "Some game data via the Star Citizen Wiki API (api.star-citizen.wiki).";
export const WIKI_SOURCE_URL = "https://api.star-citizen.wiki";
export const PACK_DIR = "fixtures/bootstrap";
/** Spec 00, criterion "Fixtures": under 2 MB total. */
export const PACK_BYTE_LIMIT = 2_000_000;

export class BuildError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "BuildError";
    this.details = details;
  }
}

export interface PackRowsInput {
  readonly GameVersion: readonly GameVersion[];
  readonly Manufacturer: readonly Manufacturer[];
  readonly Vehicle: readonly Vehicle[];
  readonly VehicleStats: readonly VehicleStats[];
  readonly Port: readonly Port[];
  readonly Item: readonly Item[];
  readonly ItemStats: readonly ItemStats[];
}

export const PACK_ENTITIES = [
  "GameVersion",
  "Manufacturer",
  "Vehicle",
  "VehicleStats",
  "Port",
  "Item",
  "ItemStats",
] as const satisfies readonly EntityName[];

export interface BuildInput {
  readonly rows: PackRowsInput;
  readonly createdAt: string;
  /** Extra files written next to the pack: README.md and samples/*.json. */
  readonly extras: ReadonlyMap<string, string>;
}

export interface BuiltPack {
  readonly manifest: Manifest;
  /** Every file to write, by path relative to the pack folder. */
  readonly files: ReadonlyMap<string, string>;
  readonly pack: DataPack;
  readonly bytes: number;
}

/** One row per line, sorted by primary key, so re-runs produce readable diffs. */
export function renderRows<K extends EntityName>(
  entity: K,
  rows: readonly Entity<K>[],
): string {
  const sorted = [...rows].sort((a, b) =>
    primaryKeyOf(entity, a).localeCompare(primaryKeyOf(entity, b)),
  );
  if (sorted.length === 0) return "[]\n";
  return `[\n${sorted.map((row) => `  ${JSON.stringify(row)}`).join(",\n")}\n]\n`;
}

/** The acceptance criterion in code: five ships, five manufacturers, five sizes. */
export function checkFiveShips(vehicles: readonly Vehicle[]): void {
  const manufacturers = new Set(vehicles.map((v) => v.manufacturer_code));
  const sizes = new Set(vehicles.map((v) => v.size_class));
  if (vehicles.length !== 5 || manufacturers.size !== 5 || sizes.size !== 5) {
    throw new BuildError(
      `the pack must hold five ships of five sizes from five manufacturers; got ${vehicles.length} ships, ${manufacturers.size} manufacturers, ${sizes.size} sizes`,
      {
        ships: vehicles.map((v) => ({
          class_name: v.class_name,
          manufacturer_code: v.manufacturer_code,
          size_class: v.size_class,
        })),
      },
    );
  }
}

export function buildPack(input: BuildInput): BuiltPack {
  checkFiveShips(input.rows.Vehicle);

  const gameVersion = input.rows.GameVersion[0];
  if (gameVersion === undefined || input.rows.GameVersion.length !== 1) {
    throw new BuildError("the pack needs exactly one GameVersion row");
  }

  const files = new Map<string, string>();
  const manifestFiles: Manifest["files"] = [];
  for (const entity of PACK_ENTITIES) {
    const rows = input.rows[entity] as readonly Entity<typeof entity>[];
    const name = `${entity}.json`;
    const text = renderRows(entity, rows);
    files.set(name, text);
    manifestFiles.push({
      name,
      entity,
      sha256: sha256Hex(text),
      bytes: utf8Bytes(text),
      count: rows.length,
    });
  }

  const manifest: Manifest = {
    schema_version: 1,
    channel: gameVersion.channel,
    game_version: gameVersion.version,
    created_at: input.createdAt,
    source: "wiki-bootstrap",
    source_url: WIKI_SOURCE_URL,
    credit: WIKI_CREDIT_LINE,
    files: manifestFiles,
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  files.set("manifest.json", manifestText);

  // The same validation the seed and the import job run. Throws PackError on any problem.
  const pack = parsePack(manifestText, (name) => files.get(name));

  for (const [name, content] of input.extras) files.set(name, content);

  const sizes = [...files].map(([name, content]) => ({
    name,
    bytes: utf8Bytes(content),
  }));
  const bytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
  if (bytes >= PACK_BYTE_LIMIT) {
    const largest = [...sizes].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
    throw new BuildError(
      `the pack is ${bytes} bytes; the criterion allows under ${PACK_BYTE_LIMIT}`,
      { bytes, largest },
    );
  }

  return { manifest, files, pack, bytes };
}

// ---------------------------------------------------------------------------
// Samples for the mapper's unit tests: trimmed by rule, never by hand
// ---------------------------------------------------------------------------

/** Keeps the first port of each distinct type (with its children) and the keys the mapper reads. */
export function trimVehicleSample(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const ports = Array.isArray(raw["ports"])
    ? (raw["ports"] as Record<string, unknown>[])
    : [];
  const seenTypes = new Set<string>();
  const sample: Record<string, unknown>[] = [];
  for (const port of ports) {
    const type = String(port["type"] ?? "");
    if (seenTypes.has(type)) continue;
    seenTypes.add(type);
    sample.push(port);
  }
  const kept = Object.fromEntries(
    Object.entries(raw).filter(
      ([key]) =>
        key === "ports" || key === "manufacturer" || !VEHICLE_RAW_DROP.has(key),
    ),
  );
  return collapseLocales({ ...kept, ports: sample }) as Record<string, unknown>;
}

export function trimItemSample(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const kept = Object.fromEntries(
    Object.entries(raw).filter(
      ([key]) => key === "manufacturer" || !ITEM_RAW_DROP.has(key),
    ),
  );
  return collapseLocales(kept) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

export interface ReadmeInput {
  readonly manifest: Manifest;
  readonly vehicles: readonly Vehicle[];
  readonly counts: Readonly<Record<string, number>>;
  readonly excluded: ReadonlyMap<string, number>;
  readonly other: ReadonlyMap<string, number>;
  readonly requests: number;
  readonly sources: readonly string[];
}

export function renderReadme(input: ReadmeInput): string {
  const ships = input.vehicles
    .map(
      (v) =>
        `| ${v.name} | \`${v.class_name}\` | ${v.manufacturer_code} | ${v.size_class ?? ""} | ${v.status} |`,
    )
    .join("\n");
  const counts = Object.entries(input.counts)
    .map(([entity, count]) => `| ${entity} | ${count} |`)
    .join("\n");
  const excluded =
    [...input.excluded]
      .sort()
      .map(([type, count]) => `\`${type}\` (${count})`)
      .join(", ") || "none";
  const other =
    [...input.other]
      .sort()
      .map(([type, count]) => `\`${type}\` (${count})`)
      .join(", ") || "none";
  const sources = input.sources.map((url) => `- ${url}`).join("\n");

  return `# fixtures/bootstrap

${WIKI_CREDIT_LINE}

Bootstrap placeholders for Phase 0: five ships, their stock loadouts and the components those loadouts reference, fetched from the Star Citizen Wiki API by \`scripts/bootstrap-fixtures\` on ${input.manifest.created_at}. Phase 1 replaces this pack with records extracted from the game files; until then every page that shows this data carries the credit line above (\`docs/legal/attribution.md\`).

**Do not edit these files by hand.** Regenerate with:

\`\`\`
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/index.ts
\`\`\`

## Contents

Game version \`${input.manifest.game_version}\`, channel ${input.manifest.channel}, as reported by the API's default version at fetch time. \`manifest.json\` lists every file with its sha256, byte size and row count; \`packages/schema\` (\`parsePack\`) validates the whole pack before anything reads it.

| Ship | class_name | Manufacturer | Size | Status |
| --- | --- | --- | --- | --- |
${ships}

| File | Rows |
| --- | --- |
${counts}

## How the API's vocabulary was mapped

Every value is the API's own; the script only maps the API's type names onto the data model's enumerations (\`scripts/bootstrap-fixtures/map.ts\`, recorded in ADR-004). Where the API's meaning was ambiguous the field is null and the original values stay in \`raw\`:

- \`VehicleStats.hydrogen_fuel\` and \`quantum_fuel\` are null; \`fuel.capacity\` and \`quantum.quantum_fuel_capacity\` map to the two capacity fields.
- \`ItemStats.power_draw\`, \`power_output\`, \`heat_generation\`, \`cooling_rate\`, \`em_signature\`, \`shield_delay\`, \`qd_range\` and \`qd_fuel_per_jump\` are null (the API gives ranges or pairs).
- Units are the API's: metres, kilograms, SCU, metres per second. No conversion was applied.
- \`Vehicle.base_variant_of\` is null: the API exposes no base-variant relation.
- \`Vehicle.role\` is the ship-matrix focus list joined with commas.
- Ports of type ${other} are kept as \`other\` and carry no stock item; \`Paints\` ports are kept as \`paint\` without one. Only component ports reference an \`Item\`.
- Interior fittings and controllers are not hardpoints and have no row: ${excluded}.
- Slugs are the kebab-case display name, prefixed with the manufacturer code only on collision.

## Samples

\`samples/\` holds raw API responses trimmed by rule (first port of each type, English text only) for the mapper's unit tests. They are the only raw responses in the repository.

## Source

${sources}

${input.requests} requests, spaced at least 2.5 seconds apart. Non-commercial use; "Please credit api.star-citizen.wiki in public projects."
`;
}
