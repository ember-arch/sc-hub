import { type Item, type ItemStats, PortType } from "schema";
import type { PortNode } from "./data";

/**
 * The stock loadout grouped by system (spec 02, "Ship page": hardpoints and stock loadout with
 * nested ports and each item linked). The raw port tree lists one row per game port; readers
 * want "what does this ship carry": the same tree folded into panels (weapons, defense, power
 * and cooling, flight, sensors and utility, cargo), identical ports merged with a count, and a
 * turret's or rack's mounted items kept nested under it. A structural port typed `other` with
 * nothing mounted is transparent: it is not listed, and whatever hangs under it (a ground
 * vehicle's module attach carries its racks, missiles and countermeasures) is listed at its
 * level, so no mounted part disappears with its mount. Pure; unit-tested over the fixture pack.
 */

export interface LoadoutEntry {
  /** Stable within a ship: the port type, the part, the size range and the children. */
  readonly key: string;
  readonly portType: PortType;
  /** The first item of the merged ports; `classes` lists every class they carry. */
  readonly item: Item | null;
  readonly classes: readonly string[];
  readonly stats: ItemStats | null;
  readonly sizeMin: number;
  readonly sizeMax: number;
  /** How many identical ports the ship has at this level. */
  readonly count: number;
  /** True when another entry at the same level shares this item's name, so the row shows the subtype. */
  readonly showSubtype: boolean;
  /** Items mounted inside this one (a turret's guns, a rack's missiles), merged the same way. */
  readonly children: readonly LoadoutEntry[];
}

export interface LoadoutGroup {
  readonly id: GroupId;
  readonly title: string;
  readonly entries: readonly LoadoutEntry[];
  /** Ports in this group, nested ones included. */
  readonly ports: number;
}

const GROUP_TITLES = {
  weapons: "Weapons",
  defense: "Defense",
  power: "Power and cooling",
  flight: "Flight",
  utility: "Sensors and utility",
  cargo: "Cargo",
} as const;
export type GroupId = keyof typeof GROUP_TITLES;

/** Which panel each port type lands in. Typed over the enum, so a new port type fails to compile until it has a home. */
const GROUP_OF: Readonly<Record<PortType, GroupId>> = {
  weapon: "weapons",
  turret: "weapons",
  missile_rack: "weapons",
  missile: "weapons",
  shield: "defense",
  armor: "defense",
  countermeasure: "defense",
  power_plant: "power",
  cooler: "power",
  quantum_drive: "flight",
  jump_module: "flight",
  thruster: "flight",
  fuel_tank: "flight",
  fuel_intake: "flight",
  radar: "utility",
  tractor_beam: "utility",
  mining_laser: "utility",
  utility: "utility",
  other: "utility",
  cargo_grid: "cargo",
  interior: "cargo",
  paint: "cargo",
};

export type StatsLookup = (className: string) => ItemStats | null;

/**
 * Ports merge when a reader would call them the same part: the item's type, display name, size
 * and subtype, not its class name. The game gives a left and a right rack (or the upper and lower
 * torpedo racks) their own class names; the entry links to the first one's page. The subtype
 * keeps apart parts that share a name but not a job, such as a hydrogen and a quantum fuel tank
 * both called "Internal Tank".
 */
function partKey(item: Item | null): string {
  return item === null
    ? "empty"
    : `${item.type}:${item.name}:${item.size}:${item.subtype ?? ""}`;
}

function entryKey(node: PortNode, children: readonly LoadoutEntry[]): string {
  const kids = children.map((c) => `${c.key}x${c.count}`).join(",");
  return `${node.port.port_type}|${partKey(node.item)}|${node.port.size_min}-${node.port.size_max}|${kids}`;
}

const listed = (node: PortNode): boolean =>
  node.port.port_type !== "other" || node.item !== null;

/** The listed ports among these, with an unlisted structural port's children in its place. */
export function throughStructure(
  nodes: readonly PortNode[],
): readonly PortNode[] {
  return nodes.flatMap((node) =>
    listed(node) ? [node] : throughStructure(node.children),
  );
}

/** Merges sibling ports that carry the same part (and the same nested parts) into one entry. */
function fold(nodes: readonly PortNode[], stats: StatsLookup): LoadoutEntry[] {
  const out = new Map<string, LoadoutEntry>();
  for (const node of nodes) {
    const children = fold(throughStructure(node.children), stats);
    const key = entryKey(node, children);
    const existing = out.get(key);
    if (existing !== undefined) {
      const cls = node.item?.class_name;
      out.set(key, {
        ...existing,
        count: existing.count + 1,
        classes:
          cls === undefined || existing.classes.includes(cls)
            ? existing.classes
            : [...existing.classes, cls],
      });
      continue;
    }
    out.set(key, {
      key,
      portType: node.port.port_type,
      item: node.item,
      classes: node.item === null ? [] : [node.item.class_name],
      stats: node.item === null ? null : stats(node.item.class_name),
      sizeMin: node.port.size_min,
      sizeMax: node.port.size_max,
      count: 1,
      showSubtype: false,
      children,
    });
  }
  const entries = [...out.values()].sort(
    (a, b) =>
      Number(a.item === null) - Number(b.item === null) ||
      b.sizeMax - a.sizeMax ||
      (a.item?.name ?? "").localeCompare(b.item?.name ?? "", "en"),
  );
  // Same name at the same level: show what tells them apart.
  const names = new Map<string, number>();
  for (const e of entries) {
    if (e.item !== null)
      names.set(e.item.name, (names.get(e.item.name) ?? 0) + 1);
  }
  return entries.map((e) =>
    e.item !== null && (names.get(e.item.name) ?? 0) > 1
      ? { ...e, showSubtype: true }
      : e,
  );
}

function countPorts(entries: readonly LoadoutEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + e.count * (1 + countPorts(e.children)),
    0,
  );
}

/** Groups the root ports of a ship into panels; a group with nothing to show is omitted. */
export function loadoutGroups(
  roots: readonly PortNode[],
  stats: StatsLookup,
): LoadoutGroup[] {
  const shown = throughStructure(roots);
  return (Object.keys(GROUP_TITLES) as GroupId[])
    .map((id) => {
      const entries = fold(
        shown.filter((node) => GROUP_OF[node.port.port_type] === id),
        stats,
      );
      return {
        id,
        title: GROUP_TITLES[id],
        entries,
        ports: countPorts(entries),
      };
    })
    .filter((group) => group.entries.length > 0);
}

/** `QuantumFuel` → `Quantum fuel`; the game's subtype strings are CamelCase. */
export function subtypeLabel(subtype: string): string {
  const words = subtype
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface Headline {
  readonly value: number;
  readonly label: string;
}

/**
 * The one number worth showing beside a mounted item, per type, when the pack has it. Only the
 * two whose scale reads without a unit (damage, shield health); the data model names no unit
 * for item stats yet, so the rest wait for spec 01 (ADR-006).
 */
export function headlineStat(
  item: Item,
  stats: ItemStats | null,
): Headline | null {
  if (stats === null) return null;
  const pick = (value: number | null, label: string): Headline | null =>
    value === null ? null : { value, label };
  switch (item.type) {
    case "weapon":
      return pick(stats.weapon_damage, "damage");
    case "missile":
      return pick(stats.weapon_damage, "damage");
    case "shield":
      return pick(stats.shield_hp, "shield HP");
    default:
      return null;
  }
}

/** Every port type has a panel; exported so a test can assert the table covers the enum. */
export const portTypeGroups: Readonly<Record<PortType, GroupId>> = GROUP_OF;
export const allPortTypes: readonly PortType[] = PortType.options;
