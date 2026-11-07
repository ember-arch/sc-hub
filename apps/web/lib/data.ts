import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  ContentItem as ContentItemSchema,
  type ContentItem,
  type DataPack,
  type GameVersion,
  type Item,
  type ItemStats,
  type Manufacturer,
  PackError,
  type Paint,
  type Port,
  type Vehicle,
  type VehicleStats,
} from "schema";
import { parsePack } from "schema/pack";
import type { ChannelVersion, SearchEntry } from "ui";
import { sentence } from "ui";

/**
 * Phase 0 data source (ADR-005): the bootstrap fixture pack, validated by the shared parser and
 * held in memory. Every route reads from here. The database (spec 01) and Meilisearch (spec 02)
 * replace the inside of this module; the view types stay.
 */

function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error("repository root (pnpm-workspace.yaml) not found");
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot(process.cwd());
const PACK_DIR = join(REPO_ROOT, "fixtures", "bootstrap");
const NEWS_FILE = join(REPO_ROOT, "fixtures", "news", "ContentItem.json");

/** Reads and validates a pack folder; the unit tests use it on fixtures/bootstrap too. */
export function loadPack(dir: string): DataPack {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new PackError(`no manifest.json in ${dir}`, {
      file: "manifest.json",
    });
  }
  return parsePack(readFileSync(manifestPath, "utf8"), (name) => {
    const path = join(dir, name);
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  });
}

/** fixtures/news is optional in Phase 0; absent means an empty feed, never an invented one. */
function loadNews(): ContentItem[] {
  if (!existsSync(NEWS_FILE)) return [];
  const rows = ContentItemSchema.array().parse(
    JSON.parse(readFileSync(NEWS_FILE, "utf8")),
  );
  return rows
    .filter((row) => !row.takedown)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

export interface ShipView {
  readonly vehicle: Vehicle;
  /** Current LIVE stats, or null when the pack has none for this ship. */
  readonly stats: VehicleStats | null;
  /** Current PTU stats, or null when no PTU build is current or it lacks this ship. */
  readonly ptu: VehicleStats | null;
  readonly manufacturer: Manufacturer | null;
  readonly paints: readonly Paint[];
}

export interface ComponentView {
  readonly item: Item;
  readonly stats: ItemStats | null;
  readonly ptu: ItemStats | null;
  readonly manufacturer: Manufacturer | null;
}

export interface PortNode {
  readonly port: Port;
  readonly item: Item | null;
  readonly children: readonly PortNode[];
}

export interface Repository {
  readonly gameVersions: readonly GameVersion[];
  readonly versions: readonly ChannelVersion[];
  readonly liveVersion: string | null;
  readonly ptuVersion: string | null;
  readonly credit: string | null;
  readonly ships: readonly ShipView[];
  readonly components: readonly ComponentView[];
  readonly manufacturers: readonly Manufacturer[];
  readonly news: readonly ContentItem[];
  readonly searchEntries: readonly SearchEntry[];
  shipBySlug(slug: string): ShipView | undefined;
  shipPorts(className: string): readonly PortNode[];
  /** The ship's base and its other variants (data-model: variants point at their base), never itself. */
  variantsOf(className: string): readonly ShipView[];
  componentBySlug(slug: string): ComponentView | undefined;
  /** Ships that carry the item in their stock loadout. */
  stockOn(className: string): readonly ShipView[];
  manufacturerBySlug(slug: string): Manufacturer | undefined;
  lineup(code: string): readonly ShipView[];
  componentsBy(code: string): readonly ComponentView[];
}

const byName = <T extends { name: string }>(a: T, b: T): number =>
  a.name.localeCompare(b.name, "en");

/** Builds the repository from a parsed pack. Exported so tests can hand in a pack with extra rows. */
export function buildRepository(
  pack: DataPack,
  news: readonly ContentItem[],
): Repository {
  const rows = pack.rows;
  const current = rows.GameVersion.filter((v) => v.is_current);
  const live = current.find((v) => v.channel === "LIVE") ?? null;
  const ptu = current.find((v) => v.channel === "PTU") ?? null;
  const isCurrent =
    (version: GameVersion | null) =>
    (row: { channel: string; game_version: string }): boolean =>
      version !== null &&
      row.channel === version.channel &&
      row.game_version === version.version;
  const isLive = isCurrent(live);
  const isPtu = isCurrent(ptu);

  const manufacturers = [...rows.Manufacturer].sort(byName);
  const manufacturerByCode = new Map(manufacturers.map((m) => [m.code, m]));
  const vehicleStats = new Map(
    rows.VehicleStats.filter(isLive).map((s) => [s.class_name, s]),
  );
  const vehiclePtu = new Map(
    rows.VehicleStats.filter(isPtu).map((s) => [s.class_name, s]),
  );
  const itemStats = new Map(
    rows.ItemStats.filter(isLive).map((s) => [s.class_name, s]),
  );
  const itemPtu = new Map(
    rows.ItemStats.filter(isPtu).map((s) => [s.class_name, s]),
  );
  const itemByClass = new Map(rows.Item.map((i) => [i.class_name, i]));
  const paintsByVehicle = new Map<string, Paint[]>();
  for (const paint of [...rows.Paint].sort(byName)) {
    const list = paintsByVehicle.get(paint.class_name) ?? [];
    list.push(paint);
    paintsByVehicle.set(paint.class_name, list);
  }

  const ships: ShipView[] = [...rows.Vehicle].sort(byName).map((vehicle) => ({
    vehicle,
    stats: vehicleStats.get(vehicle.class_name) ?? null,
    ptu: vehiclePtu.get(vehicle.class_name) ?? null,
    manufacturer: manufacturerByCode.get(vehicle.manufacturer_code) ?? null,
    paints: paintsByVehicle.get(vehicle.class_name) ?? [],
  }));
  const components: ComponentView[] = [...rows.Item]
    .sort(byName)
    .map((item) => ({
      item,
      stats: itemStats.get(item.class_name) ?? null,
      ptu: itemPtu.get(item.class_name) ?? null,
      manufacturer: manufacturerByCode.get(item.manufacturer_code) ?? null,
    }));
  const shipByClass = new Map(ships.map((s) => [s.vehicle.class_name, s]));

  const portsByVehicle = new Map<string, Port[]>();
  for (const port of rows.Port.filter(isLive)) {
    const list = portsByVehicle.get(port.class_name) ?? [];
    list.push(port);
    portsByVehicle.set(port.class_name, list);
  }
  const portTrees = new Map<string, PortNode[]>();
  const tree = (className: string): PortNode[] => {
    const cached = portTrees.get(className);
    if (cached !== undefined) return cached;
    const ports = [...(portsByVehicle.get(className) ?? [])].sort((a, b) =>
      a.port_path.localeCompare(b.port_path, "en"),
    );
    const childrenOf = new Map<string | null, Port[]>();
    for (const port of ports) {
      const list = childrenOf.get(port.parent_port_path) ?? [];
      list.push(port);
      childrenOf.set(port.parent_port_path, list);
    }
    const node = (port: Port): PortNode => ({
      port,
      item:
        port.default_item_class === null
          ? null
          : (itemByClass.get(port.default_item_class) ?? null),
      children: (childrenOf.get(port.port_path) ?? []).map(node),
    });
    const roots = (childrenOf.get(null) ?? []).map(node);
    portTrees.set(className, roots);
    return roots;
  };

  /** A variant family is the base ship plus every ship pointing at it. */
  const familyOf = (className: string): string => {
    const base = shipByClass.get(className)?.vehicle.base_variant_of;
    return base === null || base === undefined ? className : familyOf(base);
  };
  const families = new Map<string, ShipView[]>();
  for (const ship of ships) {
    const family = familyOf(ship.vehicle.class_name);
    const list = families.get(family) ?? [];
    list.push(ship);
    families.set(family, list);
  }

  const stockIndex = new Map<string, Set<string>>();
  for (const port of rows.Port.filter(isLive)) {
    if (port.default_item_class === null) continue;
    const set = stockIndex.get(port.default_item_class) ?? new Set<string>();
    set.add(port.class_name);
    stockIndex.set(port.default_item_class, set);
  }

  const searchEntries: SearchEntry[] = [
    ...ships.map((s) => ({
      type: "ship" as const,
      name: s.vehicle.name,
      href: `/ships/${s.vehicle.slug}`,
      meta: [s.manufacturer?.name, s.vehicle.role]
        .filter((x) => x != null)
        .join(" · "),
    })),
    ...components.map((c) => ({
      type: "component" as const,
      name: c.item.name,
      href: `/components/${c.item.slug}`,
      meta: [sentence(c.item.type), c.manufacturer?.name]
        .filter((x) => x != null)
        .join(" · "),
    })),
    ...manufacturers.map((m) => ({
      type: "manufacturer" as const,
      name: m.name,
      href: `/manufacturers/${m.slug}`,
      meta: "Manufacturer",
    })),
  ];

  return {
    gameVersions: rows.GameVersion,
    versions: current.map((v) => ({ channel: v.channel, version: v.version })),
    liveVersion: live?.version ?? null,
    ptuVersion: ptu?.version ?? null,
    credit: pack.manifest.credit,
    ships,
    components,
    manufacturers,
    news,
    searchEntries,
    shipBySlug: (slug) => ships.find((s) => s.vehicle.slug === slug),
    shipPorts: tree,
    variantsOf: (className) =>
      (families.get(familyOf(className)) ?? []).filter(
        (s) => s.vehicle.class_name !== className,
      ),
    componentBySlug: (slug) => components.find((c) => c.item.slug === slug),
    stockOn: (className) =>
      [...(stockIndex.get(className) ?? [])]
        .map((cls) => shipByClass.get(cls))
        .filter((s): s is ShipView => s !== undefined)
        .sort((a, b) => byName(a.vehicle, b.vehicle)),
    manufacturerBySlug: (slug) => manufacturers.find((m) => m.slug === slug),
    lineup: (code) => ships.filter((s) => s.vehicle.manufacturer_code === code),
    componentsBy: (code) =>
      components.filter((c) => c.item.manufacturer_code === code),
  };
}

let cached: Repository | undefined;

/** The repository, built once per server process. Throws PackError on an invalid pack. */
export function repo(): Repository {
  cached ??= buildRepository(loadPack(PACK_DIR), loadNews());
  return cached;
}

/** Flattens a port tree for table rendering, depth first. */
export function flattenPorts(
  nodes: readonly PortNode[],
  depth = 0,
): readonly { node: PortNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenPorts(node.children, depth + 1),
  ]);
}
