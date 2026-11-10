import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  Author as AuthorSchema,
  type Author,
  type CargoBox,
  CargoBoxes as CargoBoxesSchema,
  ContentItem as ContentItemSchema,
  type ContentItem,
  type DataPack,
  type GameVersion,
  type Item,
  type ItemStats,
  type Manufacturer,
  PackError,
  type Paint,
  SpectrumMode,
  type Port,
  type Vehicle,
  VehicleDescription as VehicleDescriptionSchema,
  type VehicleDescription,
  type VehicleStats,
} from "schema";
import { parsePack } from "schema/pack";
import { editionBase, isPlaceholderName } from "./editions";
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
const AUTHORS_FILE = join(REPO_ROOT, "fixtures", "news", "Author.json");
const DESCRIPTIONS_FILE = join(
  REPO_ROOT,
  "fixtures",
  "descriptions",
  "VehicleDescription.json",
);

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

/**
 * The news pack (ADR-027): optional, absent means an empty feed, never an invented one. The pack
 * is append-only with revisions (CLAUDE.md section 5): the latest revision of each item shows,
 * a takedown hides it, newest first.
 */
function loadNews(hiddenAuthors: ReadonlySet<string>): ContentItem[] {
  if (!existsSync(NEWS_FILE)) return [];
  return visibleNews(
    ContentItemSchema.array().parse(
      JSON.parse(readFileSync(NEWS_FILE, "utf8")),
    ),
    { spectrum: spectrumOn(), hiddenAuthors },
  );
}

/**
 * What the site shows of the pack's rows: the latest revision of each item, no takedown, no
 * Spectrum item unless the module is on, none by an author under takedown; newest first.
 */
export function visibleNews(
  rows: readonly ContentItem[],
  options: {
    readonly spectrum: boolean;
    readonly hiddenAuthors: ReadonlySet<string>;
  },
): ContentItem[] {
  const dev = options.spectrum;
  const hiddenAuthors = options.hiddenAuthors;
  const latest = new Map<string, ContentItem>();
  for (const row of rows) {
    const key = `${row.source}:${row.external_id}`;
    const seen = latest.get(key);
    if (seen === undefined || row.revision > seen.revision)
      latest.set(key, row);
  }
  return [...latest.values()]
    .filter(
      (row) =>
        !row.takedown &&
        (dev || row.source !== "spectrum") &&
        (row.author_id === null || !hiddenAuthors.has(row.author_id)),
    )
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/**
 * Whether the Spectrum module is on (spec 03, ADR-027): `SPECTRUM_MODE` is `poll` or `feed`. With
 * `off`, the deployed default until docs/legal/cig-approval.md ticks the Spectrum box, no
 * developer post or author reaches a page, whatever the pack holds.
 */
export function spectrumOn(): boolean {
  const mode = SpectrumMode.safeParse(process.env["SPECTRUM_MODE"] ?? "off");
  return mode.success && mode.data !== "off";
}

/**
 * The authors the Spectrum worker has seen (fixtures/news/Author.json), takedowns included so
 * their posts can be hidden too (data-model: the author kill switch hides all posts); none with
 * the module off.
 */
function loadAuthors(): Author[] {
  if (!spectrumOn() || !existsSync(AUTHORS_FILE)) return [];
  return AuthorSchema.array().parse(
    JSON.parse(readFileSync(AUTHORS_FILE, "utf8")),
  );
}

/**
 * CIG's in-game text for a ship (ADR-008): copied from the game localization as the wiki API serves
 * it by scripts/bootstrap-fixtures/descriptions.ts, never written by hand. Optional like the news
 * fixture; validated at the boundary with the schema package type (ADR-008).
 */

function loadDescriptions(): VehicleDescription[] {
  if (!existsSync(DESCRIPTIONS_FILE)) return [];
  return VehicleDescriptionSchema.array().parse(
    JSON.parse(readFileSync(DESCRIPTIONS_FILE, "utf8")),
  );
}

const CARGO_BOXES_FILE = join(REPO_ROOT, "fixtures", "cargo", "CargoBox.json");
let cachedBoxes:
  { rows: readonly CargoBox[]; version: string | null } | undefined;

function loadCargoBoxes(): {
  rows: readonly CargoBox[];
  version: string | null;
} {
  if (cachedBoxes === undefined) {
    if (existsSync(CARGO_BOXES_FILE)) {
      const file = CargoBoxesSchema.parse(
        JSON.parse(readFileSync(CARGO_BOXES_FILE, "utf8")),
      );
      cachedBoxes = { rows: file.rows, version: file.game_version };
    } else {
      cachedBoxes = { rows: [], version: null };
    }
  }
  return cachedBoxes;
}

/**
 * The standard cargo containers' shapes (ADR-028), read from the cargo item records by
 * scripts/bootstrap-fixtures/cargo-boxes.ts; empty without the fixture, and the Cargo section
 * then shows the grids without boxes.
 */
export function cargoBoxes(): readonly CargoBox[] {
  return loadCargoBoxes().rows;
}

/** The build the shapes were read for, so the page can say when it is not the pack's. */
export function cargoBoxesVersion(): string | null {
  return loadCargoBoxes().version;
}

export interface ShipView {
  readonly vehicle: Vehicle;
  /** The entry this ship is an edition of (same name and maker, ADR-022), or null for an entry. */
  readonly editionOf: Vehicle | null;
  /** The name, with the class name after it when another ship of that name is the entry. */
  readonly label: string;
  /** Current LIVE stats, or null when the pack has none for this ship. */
  readonly stats: VehicleStats | null;
  /** Current PTU stats, or null when no PTU build is current or it lacks this ship. */
  readonly ptu: VehicleStats | null;
  readonly manufacturer: Manufacturer | null;
  readonly paints: readonly Paint[];
  /** CIG's in-game description for the current LIVE build, or null. */
  readonly description: VehicleDescription | null;
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
  /** Every vehicle in the pack, editions included; slugs resolve against this list. */
  readonly ships: readonly ShipView[];
  /** The ships listed as entries: every vehicle that is not an edition of another (ADR-022). */
  readonly entries: readonly ShipView[];
  readonly components: readonly ComponentView[];
  readonly manufacturers: readonly Manufacturer[];
  readonly news: readonly ContentItem[];
  /** CIG staff seen on Spectrum; empty with the module off. */
  readonly authors: readonly Author[];
  readonly searchEntries: readonly SearchEntry[];
  shipBySlug(slug: string): ShipView | undefined;
  shipPorts(className: string): readonly PortNode[];
  /** The ship's base and its other variants (data-model: variants point at their base), never itself. */
  variantsOf(className: string): readonly ShipView[];
  /** The editions listed under this ship, by name. */
  editionsOf(className: string): readonly ShipView[];
  componentBySlug(slug: string): ComponentView | undefined;
  componentByClass(className: string): ComponentView | undefined;
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
  descriptions: readonly VehicleDescription[] = [],
  authors: readonly Author[] = [],
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
  const itemByClass = new Map(
    rows.Item.map((i) => [
      i.class_name,
      isPlaceholderName(i.name) ? { ...i, name: i.class_name } : i,
    ]),
  );
  const paintsByVehicle = new Map<string, Paint[]>();
  for (const paint of [...rows.Paint].sort(byName)) {
    const list = paintsByVehicle.get(paint.class_name) ?? [];
    list.push(paint);
    paintsByVehicle.set(paint.class_name, list);
  }

  const vehicleByClass = new Map(rows.Vehicle.map((v) => [v.class_name, v]));
  const ships: ShipView[] = [...rows.Vehicle].sort(byName).map((vehicle) => ({
    vehicle,
    editionOf: editionBase(vehicle, vehicleByClass),
    label:
      editionBase(vehicle, vehicleByClass) === null
        ? vehicle.name
        : `${vehicle.name} (${vehicle.class_name})`,
    stats: vehicleStats.get(vehicle.class_name) ?? null,
    ptu: vehiclePtu.get(vehicle.class_name) ?? null,
    manufacturer: manufacturerByCode.get(vehicle.manufacturer_code) ?? null,
    paints: paintsByVehicle.get(vehicle.class_name) ?? [],
    // Only text for the build the page shows; another version's text would mix versions.
    description:
      descriptions.find(
        (d) =>
          d.class_name === vehicle.class_name &&
          live !== null &&
          d.channel === live.channel &&
          d.game_version === live.version,
      ) ?? null,
  }));
  // A part without a name shows its class name (editions.ts); the row keeps the API's value.
  const named = rows.Item.map((item) =>
    isPlaceholderName(item.name) ? { ...item, name: item.class_name } : item,
  );
  const components: ComponentView[] = [...named].sort(byName).map((item) => ({
    item,
    stats: itemStats.get(item.class_name) ?? null,
    ptu: itemPtu.get(item.class_name) ?? null,
    manufacturer: manufacturerByCode.get(item.manufacturer_code) ?? null,
  }));
  const shipByClass = new Map(ships.map((s) => [s.vehicle.class_name, s]));
  const entries = ships.filter((s) => s.editionOf === null);
  const componentByClass = new Map(
    components.map((c) => [c.item.class_name, c]),
  );

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

  /** A variant family is the base ship plus every ship pointing at it. A cycle or a dangling base ends the walk. */
  const familyOf = (className: string): string => {
    const seen = new Set<string>();
    let current = className;
    for (;;) {
      seen.add(current);
      const base = shipByClass.get(current)?.vehicle.base_variant_of;
      if (base == null || seen.has(base) || !shipByClass.has(base)) {
        return current;
      }
      current = base;
    }
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
    ...entries.map((s) => ({
      type: "ship" as const,
      name: s.vehicle.name,
      href: `/ships/${s.vehicle.slug}`,
      meta: [s.manufacturer?.name, s.vehicle.role]
        .filter((x) => x != null)
        .join(" · "),
    })),
    // A part with no name of its own is not searched for.
    ...components
      .filter((c) => c.item.name !== c.item.class_name)
      .map((c) => ({
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
    entries,
    components,
    manufacturers,
    news,
    authors,
    searchEntries,
    shipBySlug: (slug) => ships.find((s) => s.vehicle.slug === slug),
    shipPorts: tree,
    variantsOf: (className) =>
      (families.get(familyOf(className)) ?? []).filter(
        (s) => s.vehicle.class_name !== className,
      ),
    editionsOf: (className) =>
      ships.filter((s) => s.editionOf?.class_name === className),
    componentBySlug: (slug) => components.find((c) => c.item.slug === slug),
    componentByClass: (className) => componentByClass.get(className),
    // The ship that carries the part, an edition included (its loadout can differ from its
    // base's); the label tells an edition apart.
    stockOn: (className) =>
      [...(stockIndex.get(className) ?? [])]
        .map((cls) => shipByClass.get(cls))
        .filter((s): s is ShipView => s !== undefined)
        .sort(
          (a, b) =>
            byName(a.vehicle, b.vehicle) ||
            a.vehicle.class_name.localeCompare(b.vehicle.class_name),
        ),
    manufacturerBySlug: (slug) => manufacturers.find((m) => m.slug === slug),
    lineup: (code) =>
      entries.filter((s) => s.vehicle.manufacturer_code === code),
    componentsBy: (code) =>
      components.filter((c) => c.item.manufacturer_code === code),
  };
}

let cached: Repository | undefined;

/** The repository, built once per server process. Throws PackError on an invalid pack. */
export function repo(): Repository {
  if (cached === undefined) {
    const authors = loadAuthors();
    cached = buildRepository(
      loadPack(PACK_DIR),
      loadNews(new Set(authors.filter((a) => a.takedown).map((a) => a.id))),
      loadDescriptions(),
      authors.filter((a) => !a.takedown),
    );
  }
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
