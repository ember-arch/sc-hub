import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Item, ItemStats, Port } from "schema";
import {
  PACK_DIR,
  buildPack,
  renderReadme,
  trimItemSample,
  trimVehicleSample,
} from "./build.js";
import { type Entity, ROW_KEYS, appendRows, pinSlugs } from "./append.js";
import { createWikiClient } from "./fetch.js";
import {
  MapError,
  type Named,
  assignSlugs,
  slugify,
  catalogRecord,
  fitsAPort,
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
  CATALOG_TYPES,
  ShipList,
  WikiGameVersionResponse,
  WikiItem,
  WikiItemListResponse,
  WikiItemResponse,
  type WikiManufacturer,
  WikiVehicleListResponse,
  WikiVehicleResponse,
} from "./types.js";
import { userAgent } from "../user-agent.js";

/**
 * One-off dev script (CLAUDE.md section 4: nothing in scripts/ runs in production). Fetches the
 * ships in ships.json, or every vehicle in the build when it says `"all": true` (ADR-022), from
 * the Star Citizen Wiki API, maps them onto the schema, validates the result as a data pack and
 * writes fixtures/bootstrap/. Any problem halts with a JSON report on
 * stderr and exit code 1; nothing is written unless every check passes.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, PACK_DIR);
const runId = randomUUID();
const startedAt = Date.now();

const USER_AGENT = userAgent("bootstrap");

type PackRows = Partial<Record<Entity, Record<string, unknown>[]>>;

/** The pack on disk, when its manifest is for `version`; null otherwise (a new build starts clean). */
function previousPack(version: string): PackRows | null {
  const manifestPath = join(outDir, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    game_version?: string;
  };
  if (manifest.game_version !== version) return null;
  const out: PackRows = {};
  for (const entity of Object.keys(ROW_KEYS) as Entity[]) {
    const file = join(outDir, `${entity}.json`);
    if (existsSync(file))
      out[entity] = JSON.parse(readFileSync(file, "utf8")) as Record<
        string,
        unknown
      >[];
  }
  return out;
}

const slugsOf = (rows: readonly Record<string, unknown>[]) =>
  new Map(rows.map((r) => [String(r["class_name"]), String(r["slug"])]));

function log(event: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
}

async function main(): Promise<void> {
  const { ships, all } = ShipList.parse(
    JSON.parse(readFileSync(join(here, "ships.json"), "utf8")),
  );
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
    log,
  });
  const sources: string[] = [];
  // Optional response cache for development reruns, always outside the repository (never committed).
  const cacheDir = process.env["BOOTSTRAP_CACHE_DIR"];
  if (cacheDir !== undefined && cacheDir !== "") {
    const inside = relative(repoRoot, resolve(cacheDir));
    if (inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
      throw new MapError(
        `BOOTSTRAP_CACHE_DIR must point outside the repository: ${cacheDir}`,
      );
    }
  }
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

  // Which ships: the names in ships.json, or every vehicle the API lists for the build (ADR-022).
  // A display name is ambiguous on the wiki (it resolves to special editions), class_name is not.
  const targets: { className: string; uuid: string }[] = [];
  let placeholders = 0;
  if (all) {
    for (let page = 1; ; page += 1) {
      const list = WikiVehicleListResponse.parse(
        await get(`/api/vehicles?page[size]=200&page[number]=${page}`),
      );
      for (const entry of list.data) {
        // The wiki keeps unnamed placeholders the game files declare; they are not ships.
        if (/^<=.*=>$/.test(entry.name.trim())) {
          placeholders += 1;
          continue;
        }
        if (!targets.some((t) => t.className === entry.class_name)) {
          targets.push({ className: entry.class_name, uuid: entry.uuid });
        }
      }
      if (list.meta === undefined || page >= list.meta.last_page) break;
    }
    targets.sort((a, b) => a.className.localeCompare(b.className));
    log({
      event: "bootstrap.listed",
      vehicles: targets.length,
      placeholders,
    });
  } else {
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
      targets.push({ className, uuid: exact[0]?.uuid ?? "" });
    }
  }

  // Each vehicle by uuid, with its port tree.
  const vehicleRaws = new Map<string, Record<string, unknown>>();
  const vehicles = [];
  for (const { className, uuid } of targets) {
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
  // The pack on disk, when it is for this build: its rows and slugs are kept (append.ts).
  const previous = previousPack(version);
  const fallbacks =
    (named: readonly Named[]) =>
    (cls: string): string[] => {
      const row = named.find((n) => n.class_name === cls);
      return row === undefined
        ? [slugify(cls)]
        : [
            `${slugify(row.manufacturer_code)}-${slugify(row.name)}`,
            slugify(cls),
          ];
    };
  const vehicleSlugs = pinSlugs(
    assignSlugs(vehicleNames),
    slugsOf(previous?.Vehicle ?? []),
    fallbacks(vehicleNames),
  );

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

  // The catalogue the loadout editor offers (ADR-016), 200 records a page. Stock parts are already
  // in. A part that fits no port on the pack's ships, has the wiki's placeholder name or comes
  // from another build is left out and counted; the rest keep a record trimmed by rule.
  const stockCount = items.length;
  let catalogSkipped = 0;
  for (const type of CATALOG_TYPES) {
    for (let page = 1; ; page += 1) {
      const json = await get(
        `/api/items?filter[type]=${type}&page[size]=200&page[number]=${page}`,
      );
      const list = WikiItemListResponse.parse(json);
      const raws = (json as { data: Record<string, unknown>[] }).data;
      list.data.forEach((raw, i) => {
        if (itemRaws.has(raw.class_name)) return;
        if (
          /^<=.*=>$/.test(raw.name.trim()) ||
          raw.version !== version ||
          !fitsAPort(raw.type, raw.size, portRows)
        ) {
          catalogSkipped += 1;
          return;
        }
        const record = catalogRecord(raws[i]!);
        itemRaws.set(raw.class_name, record);
        items.push(WikiItem.parse(record));
        manufacturerSources.push(raw.manufacturer);
      });
      if (page >= list.meta.last_page) break;
    }
  }
  log({
    event: "bootstrap.fetched",
    kind: "catalog",
    count: items.length - stockCount,
    skipped: catalogSkipped,
  });

  const itemNames: Named[] = items.map((i) => ({
    class_name: i.class_name,
    name: i.name,
    manufacturer_code: i.manufacturer.code,
  }));
  const itemSlugs = pinSlugs(
    assignSlugs(itemNames),
    slugsOf(previous?.Item ?? []),
    fallbacks(itemNames),
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

  const keep = <T extends Record<string, unknown>>(
    entity: Entity,
    next: readonly T[],
  ): T[] =>
    appendRows(entity, (previous?.[entity] ?? []) as unknown as T[], next);
  // Samples follow their rows: for the same build, the published sample is kept.
  if (previous !== null) {
    for (const name of [...extras.keys()]) {
      const file = join(outDir, name);
      if (name.startsWith("samples/") && existsSync(file))
        extras.set(name, readFileSync(file, "utf8"));
    }
  }
  const rows = {
    GameVersion: keep("GameVersion", [gameVersionRow]),
    Manufacturer: keep("Manufacturer", manufacturerRows),
    Vehicle: keep("Vehicle", vehicleRows),
    VehicleStats: keep("VehicleStats", vehicleStatsRows),
    Port: keep("Port", portRows),
    Item: keep("Item", itemRows),
    ItemStats: keep("ItemStats", itemStatsRows),
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
