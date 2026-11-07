import type { Item, ItemStats, PortType } from "schema";
import type { PortNode } from "./data";

/**
 * The stock loadout grouped by system (spec 02, "Ship page": hardpoints and stock loadout with
 * nested ports and each item linked). The raw port tree lists one row per game port; readers
 * want "what does this ship carry": the same tree folded into panels (weapons, defense, power
 * and cooling, flight, sensors and utility, cargo), identical ports merged with a count, and a
 * turret's or rack's mounted items kept nested under it. Structural ports typed `other` with
 * nothing mounted are counted, not listed. Pure; unit-tested over the fixture pack.
 */

export interface LoadoutEntry {
  /** Stable within a ship: the port type, the item class (or "empty"), the size range and the children. */
  readonly key: string;
  readonly portType: PortType;
  readonly item: Item | null;
  readonly stats: ItemStats | null;
  readonly sizeMin: number;
  readonly sizeMax: number;
  /** How many identical ports the ship has at this level. */
  readonly count: number;
  /** Items mounted inside this one (a turret's guns, a rack's missiles), merged the same way. */
  readonly children: readonly LoadoutEntry[];
}

export interface LoadoutGroup {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly LoadoutEntry[];
  /** Ports in this group, nested ones included. */
  readonly ports: number;
}

/** Which panel each port type lands in; `other` only when something is mounted. */
const GROUPS: readonly {
  id: string;
  title: string;
  types: readonly PortType[];
}[] = [
  {
    id: "weapons",
    title: "Weapons",
    types: ["weapon", "turret", "missile_rack", "missile"],
  },
  {
    id: "defense",
    title: "Defense",
    types: ["shield", "armor", "countermeasure"],
  },
  { id: "power", title: "Power and cooling", types: ["power_plant", "cooler"] },
  {
    id: "flight",
    title: "Flight",
    types: [
      "quantum_drive",
      "jump_module",
      "thruster",
      "fuel_tank",
      "fuel_intake",
    ],
  },
  {
    id: "utility",
    title: "Sensors and utility",
    types: ["radar", "tractor_beam", "mining_laser", "utility", "other"],
  },
  { id: "cargo", title: "Cargo", types: ["cargo_grid", "interior", "paint"] },
];

export type StatsLookup = (className: string) => ItemStats | null;

/**
 * Ports merge when a reader would call them the same thing: the item's display name, type and
 * size, not its class name. The game gives a left and a right rack (or the upper and lower
 * torpedo racks) their own class names; the entry links to the first one's page.
 */
function entryKey(node: PortNode, children: readonly LoadoutEntry[]): string {
  const item =
    node.item === null
      ? "empty"
      : `${node.item.type}:${node.item.name}:${node.item.size}`;
  const kids = children.map((c) => `${c.key}x${c.count}`).join(",");
  return `${node.port.port_type}|${item}|${node.port.size_min}-${node.port.size_max}|${kids}`;
}

/** Merges sibling ports that carry the same item (and the same nested items) into one entry. */
function fold(nodes: readonly PortNode[], stats: StatsLookup): LoadoutEntry[] {
  const out = new Map<string, LoadoutEntry>();
  for (const node of nodes) {
    const children = fold(
      node.children.filter(
        (c) => c.port.port_type !== "other" || c.item !== null,
      ),
      stats,
    );
    const key = entryKey(node, children);
    const existing = out.get(key);
    if (existing !== undefined) {
      out.set(key, { ...existing, count: existing.count + 1 });
      continue;
    }
    out.set(key, {
      key,
      portType: node.port.port_type,
      item: node.item,
      stats: node.item === null ? null : stats(node.item.class_name),
      sizeMin: node.port.size_min,
      sizeMax: node.port.size_max,
      count: 1,
      children,
    });
  }
  // Mounted items first, larger first, then by name; empty ports last.
  return [...out.values()].sort(
    (a, b) =>
      Number(a.item === null) - Number(b.item === null) ||
      b.sizeMax - a.sizeMax ||
      (a.item?.name ?? "").localeCompare(b.item?.name ?? "", "en"),
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
  const listed = roots.filter(
    (node) => node.port.port_type !== "other" || node.item !== null,
  );
  return GROUPS.map((group) => {
    const entries = fold(
      listed.filter((node) => group.types.includes(node.port.port_type)),
      stats,
    );
    return {
      id: group.id,
      title: group.title,
      entries,
      ports: countPorts(entries),
    };
  }).filter((group) => group.entries.length > 0);
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
