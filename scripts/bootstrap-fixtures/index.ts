import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Item, ItemStats, Port } from "schema";
import {
  PACK_DIR,
  buildPack,
  renderReadme,
  trimItemSample,
  trimVehicleSample,
} from "./build.js";
import { createWikiClient } from "./fetch.js";
import {
  MapError,
  type Named,
  assignSlugs,
  mapChannel,
  mapGameVersion,
  mapItem,
  mapItemStats,
  mapManufacturers,
  mapPorts,
  mapVehicle,
  mapVehicleStats,
} from "./map.js";
import {
  ShipList,
  WikiGameVersionResponse,
  WikiItemResponse,
  type WikiManufacturer,
  WikiVehicleListResponse,
  WikiVehicleResponse,
} from "./types.js";

/**
 * One-off dev script (CLAUDE.md section 4: nothing in scripts/ runs in production). Fetches the
 * five ships in ships.json from the Star Citizen Wiki API, maps them onto the schema, validates the
 * result as a data pack and writes fixtures/bootstrap/. Any problem halts with a JSON report on
 * stderr and exit code 1; nothing is written unless every check passes.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, PACK_DIR);
const runId = randomUUID();
const startedAt = Date.now();

const USER_AGENT =
  "sc-hub-bootstrap/0.0 (non-commercial fan reference; github.com/ember-arch/sc-hub)";

function log(event: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
}

async function main(): Promise<void> {
  const ships = ShipList.parse(
    JSON.parse(readFileSync(join(here, "ships.json"), "utf8")),
  ).ships;
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
    log,
  });
  const sources: string[] = [];
  // Optional response cache for development reruns, always outside the repository (never committed).
  const cacheDir = process.env["BOOTSTRAP_CACHE_DIR"];
  const get = async (path: string): Promise<unknown> => {
    sources.push(path);
    if (cacheDir === undefined || cacheDir === "") return client.getJson(path);
    const file = join(
      cacheDir,
      `${createHash("sha1").update(path).digest("hex")}.json`,
    );
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    const json = await client.getJson(path);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, JSON.stringify(json), "utf8");
    return json;
  };

  const versionResponse = WikiGameVersionResponse.parse(
    await get("/api/game-versions/default"),
  ).data;
  const version = versionResponse.code;
  const channel = mapChannel(versionResponse.channel);
  const now = new Date().toISOString();
  log({ event: "bootstrap.version", channel, version });

  // Vehicles: resolve each class name to exactly one record, then fetch it with its port tree.
  // A display name is ambiguous on the wiki (it resolves to special editions), class_name is not.
  const vehicleRaws = new Map<string, Record<string, unknown>>();
  const vehicles = [];
  for (const className of ships) {
    const list = WikiVehicleListResponse.parse(
      await get(
        `/api/vehicles?filter[class_name]=${encodeURIComponent(className)}&page[size]=50`,
      ),
    ).data;
    const exact = list.filter((entry) => entry.class_name === className);
    if (exact.length !== 1) {
      throw new MapError(
        `class name ${className} matched ${exact.length} vehicles exactly (${list.length} partial matches); expected exactly one`,
        {
          class_name: className,
          candidates: list.map((entry) => entry.class_name),
        },
      );
    }
    const uuid = exact[0]?.uuid ?? "";
    const json = await get(
      `/api/vehicles/${encodeURIComponent(uuid)}?include=hardpoints`,
    );
    const raw = WikiVehicleResponse.parse(json).data;
    if (raw.class_name !== className) {
      throw new MapError(
        `vehicle ${uuid} is ${raw.class_name} on the API but the list said ${className}`,
        { class_name: className, uuid },
      );
    }
    vehicleRaws.set(
      raw.class_name,
      (json as { data: Record<string, unknown> }).data,
    );
    vehicles.push(raw);
    log({
      event: "bootstrap.fetched",
      kind: "vehicle",
      class_name: raw.class_name,
      name: raw.name,
      ports: raw.ports?.length ?? 0,
    });
  }

  const manufacturerSources: WikiManufacturer[] = vehicles.map(
    (v) => v.manufacturer,
  );
  const vehicleNames: Named[] = vehicles.map((v) => ({
    class_name: v.class_name,
    name: v.name,
    manufacturer_code: v.manufacturer.code,
  }));
  const vehicleSlugs = assignSlugs(vehicleNames);

  const vehicleRows = vehicles.map((raw) =>
    mapVehicle(raw, vehicleSlugs.get(raw.class_name) ?? "", version),
  );
  const vehicleStatsRows = vehicles.map((raw) =>
    mapVehicleStats(raw, channel, version),
  );
  const portRows: Port[] = [];
  const stockItems = new Map<string, string>();
  const excluded = new Map<string, number>();
  const other = new Map<string, number>();
  const unknownTypes = new Set<string>();
  for (const raw of vehicles) {
    const mapped = mapPorts(raw, channel, version);
    for (const type of mapped.unknown) unknownTypes.add(type);
    portRows.push(...mapped.ports);
    for (const [className, uuid] of mapped.stockItems) {
      if (!stockItems.has(className)) stockItems.set(className, uuid);
    }
    for (const [type, count] of mapped.excluded) {
      excluded.set(type, (excluded.get(type) ?? 0) + count);
    }
    for (const [type, count] of mapped.other) {
      other.set(type, (other.get(type) ?? 0) + count);
    }
    log({
      event: "bootstrap.mapped",
      kind: "vehicle",
      class_name: raw.class_name,
      ports: mapped.ports.length,
      stock_items: mapped.stockItems.size,
    });
  }

  if (unknownTypes.size > 0) {
    const list = [...unknownTypes].sort();
    throw new MapError(
      `port types the mapper does not know: ${list.map((t) => JSON.stringify(t)).join(", ")}. Add each to the type table in scripts/bootstrap-fixtures/map.ts as map, other or exclude.`,
      { types: list },
    );
  }

  // Every distinct stock component, once, by uuid.
  const itemRaws = new Map<string, Record<string, unknown>>();
  const items = [];
  const sortedStock = [...stockItems].sort(([a], [b]) => a.localeCompare(b));
  for (const [className, uuid] of sortedStock) {
    const json = await get(`/api/items/${encodeURIComponent(uuid)}`);
    const raw = WikiItemResponse.parse(json).data;
    if (raw.class_name !== className) {
      throw new MapError(
        `item ${uuid} is ${raw.class_name} on the API but the port said ${className}`,
        { class_name: className, uuid },
      );
    }
    itemRaws.set(
      raw.class_name,
      (json as { data: Record<string, unknown> }).data,
    );
    items.push(raw);
    manufacturerSources.push(raw.manufacturer);
  }
  log({ event: "bootstrap.fetched", kind: "items", count: items.length });

  const itemSlugs = assignSlugs(
    items.map((i) => ({
      class_name: i.class_name,
      name: i.name,
      manufacturer_code: i.manufacturer.code,
    })),
  );
  const itemRows: Item[] = items.map((raw) =>
    mapItem(raw, itemSlugs.get(raw.class_name) ?? "", version),
  );
  const itemStatsRows: ItemStats[] = items.map((raw) =>
    mapItemStats(raw, channel, version),
  );
  const manufacturerRows = mapManufacturers(manufacturerSources);
  const gameVersionRow = mapGameVersion(
    versionResponse,
    now,
    `${PACK_DIR}/manifest.json`,
  );

  // Samples: the vehicle with the fewest ports that still nests, and one item of three kinds.
  const extras = new Map<string, string>();
  const nested = vehicles
    .filter((v) => (v.ports ?? []).some((p) => (p.ports ?? []).length > 0))
    .sort((a, b) => (a.ports?.length ?? 0) - (b.ports?.length ?? 0));
  const sampleVehicle = nested[0] ?? vehicles[0];
  if (sampleVehicle !== undefined) {
    const raw = vehicleRaws.get(sampleVehicle.class_name);
    if (raw !== undefined) {
      extras.set(
        "samples/vehicle.json",
        `${JSON.stringify(trimVehicleSample(raw), null, 2)}\n`,
      );
    }
  }
  for (const [kind, type] of [
    ["weapon", "WeaponGun"],
    ["shield", "Shield"],
    ["quantum-drive", "QuantumDrive"],
  ] as const) {
    const item = items.find((i) => i.type === type);
    const raw = item === undefined ? undefined : itemRaws.get(item.class_name);
    if (raw !== undefined) {
      extras.set(
        `samples/item-${kind}.json`,
        `${JSON.stringify(trimItemSample(raw), null, 2)}\n`,
      );
    }
  }

  const rows = {
    GameVersion: [gameVersionRow],
    Manufacturer: manufacturerRows,
    Vehicle: vehicleRows,
    VehicleStats: vehicleStatsRows,
    Port: portRows,
    Item: itemRows,
    ItemStats: itemStatsRows,
  };
  const counts = Object.fromEntries(
    Object.entries(rows).map(([entity, list]) => [entity, list.length]),
  );
  // Build once without the README to get the manifest, then render the README from it.
  const draft = buildPack({ rows, createdAt: now, extras });
  extras.set(
    "README.md",
    renderReadme({
      manifest: draft.manifest,
      vehicles: vehicleRows,
      counts,
      excluded,
      other,
      requests: sources.length,
      sources: sources.map((path) => `https://api.star-citizen.wiki${path}`),
    }),
  );
  const built = buildPack({ rows, createdAt: now, extras });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "samples"), { recursive: true });
  for (const [name, content] of built.files) {
    writeFileSync(join(outDir, name), content, "utf8");
  }

  process.stdout.write(
    `${JSON.stringify({
      event: "bootstrap.summary",
      run_id: runId,
      channel,
      game_version: version,
      requests: sources.length,
      counts,
      excluded: Object.fromEntries(excluded),
      other: Object.fromEntries(other),
      bytes: built.bytes,
      files: built.files.size,
      out_dir: PACK_DIR,
      errors: 0,
      duration_ms: Date.now() - startedAt,
    })}\n`,
  );
}

main().catch((error: unknown) => {
  const details =
    error !== null && typeof error === "object" && "details" in error
      ? (error as { details: unknown }).details
      : undefined;
  log({
    event: "bootstrap.failed",
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    details,
    duration_ms: Date.now() - startedAt,
  });
  process.exitCode = 1;
});
