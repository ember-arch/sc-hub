import type { LoadoutEntry, LoadoutGroup } from "./loadout";

/**
 * The armament at a glance (ADR-008): every gun and every missile or torpedo the stock loadout
 * mounts, counted through turrets and racks, grouped by size. Pure; built from the loadout panels'
 * groups so the counts agree with the panels below.
 */

export interface ArmamentRow {
  readonly kind: "guns" | "missiles";
  /** Size class to count, largest first. */
  readonly sizes: readonly { readonly size: number; readonly count: number }[];
  readonly total: number;
}

function walk(
  entries: readonly LoadoutEntry[],
  multiplier: number,
  into: Map<string, Map<number, number>>,
): void {
  for (const entry of entries) {
    const count = entry.count * multiplier;
    const type = entry.item?.type;
    const kind =
      type === "weapon" ? "guns" : type === "missile" ? "missiles" : null;
    if (kind !== null && entry.item !== null) {
      const bySize = into.get(kind) ?? new Map<number, number>();
      bySize.set(entry.item.size, (bySize.get(entry.item.size) ?? 0) + count);
      into.set(kind, bySize);
    }
    walk(entry.children, count, into);
  }
}

export function armament(groups: readonly LoadoutGroup[]): ArmamentRow[] {
  const into = new Map<string, Map<number, number>>();
  for (const group of groups) walk(group.entries, 1, into);
  return (["guns", "missiles"] as const)
    .map((kind) => {
      const bySize = into.get(kind) ?? new Map<number, number>();
      const sizes = [...bySize]
        .map(([size, count]) => ({ size, count }))
        .sort((a, b) => b.size - a.size);
      return { kind, sizes, total: sizes.reduce((n, s) => n + s.count, 0) };
    })
    .filter((row) => row.total > 0);
}

/**
 * The armament by who fires it (ADR-016): the pilot's guns (fixed or on gimbals), each turret with
 * its guns or missiles, and the missile racks, every line a part with its size, how many and what
 * one does. Built from the same loadout groups as the counts above, so they agree.
 */

export type ArmamentKind = "gun" | "missile" | "torpedo";

export interface ArmamentLine {
  readonly kind: ArmamentKind;
  readonly size: number;
  readonly name: string;
  readonly slug: string;
  readonly count: number;
  /** Guns: damage per second while firing, each. Missiles and torpedoes: damage on detonation, each. */
  readonly damage: number | null;
  /** Guns: "Laser repeater"; missiles: what they track. */
  readonly detail: string | null;
}

export interface ArmamentMount {
  readonly key: string;
  /** "Pilot guns", "Missile racks", or the turret's own name. */
  readonly title: string;
  /** Identical turrets are one mount: how many there are. The lines are for one of them. */
  readonly copies: number;
  readonly lines: readonly ArmamentLine[];
}

/** Gimbals are the pilot's; every other turret type is crewed or remote. */
const PILOT_MOUNTS = new Set(["GunTurret"]);

export function armamentPlan(
  groups: readonly LoadoutGroup[],
  figures: (entry: LoadoutEntry) => {
    damage: number | null;
    detail: string | null;
  },
): ArmamentMount[] {
  const pilot = new Map<string, ArmamentLine>();
  const racks = new Map<string, ArmamentLine>();
  const turrets: ArmamentMount[] = [];
  const add = (
    into: Map<string, ArmamentLine>,
    entry: LoadoutEntry,
    count: number,
  ) => {
    const item = entry.item;
    if (item === null) return;
    const kind: ArmamentKind | null =
      item.type === "weapon"
        ? "gun"
        : item.type === "missile"
          ? item.subtype === "Torpedo"
            ? "torpedo"
            : "missile"
          : null;
    if (kind === null) return;
    const key = `${kind}:${item.class_name}`;
    const was = into.get(key);
    if (was !== undefined) {
      into.set(key, { ...was, count: was.count + count });
      return;
    }
    const f = figures(entry);
    into.set(key, {
      kind,
      size: item.size,
      name: item.name,
      slug: item.slug,
      count,
      damage: f.damage,
      detail: f.detail,
    });
  };
  const collect = (
    entries: readonly LoadoutEntry[],
    multiplier: number,
    into: Map<string, ArmamentLine>,
  ) => {
    for (const e of entries) {
      const count = e.count * multiplier;
      add(into, e, count);
      collect(e.children, count, into);
    }
  };
  const sorted = (lines: Map<string, ArmamentLine>) =>
    [...lines.values()].sort(
      (a, b) => b.size - a.size || a.name.localeCompare(b.name, "en"),
    );

  for (const group of groups) {
    if (group.id !== "weapons") continue;
    for (const entry of group.entries) {
      const item = entry.item;
      if (item?.type === "turret" && !PILOT_MOUNTS.has(item.subtype ?? "")) {
        const own = new Map<string, ArmamentLine>();
        collect(entry.children, 1, own);
        if (own.size === 0) continue;
        turrets.push({
          key: entry.key,
          title: item.name,
          copies: entry.count,
          lines: sorted(own),
        });
      } else if (
        entry.portType === "missile_rack" ||
        item?.type === "missile_rack"
      ) {
        collect([entry], 1, racks);
      } else {
        collect([entry], 1, pilot);
      }
    }
  }
  return [
    ...(pilot.size === 0
      ? []
      : [
          {
            key: "pilot",
            title: "Pilot guns",
            copies: 1,
            lines: sorted(pilot),
          },
        ]),
    ...turrets,
    ...(racks.size === 0
      ? []
      : [
          {
            key: "racks",
            title: "Missile racks",
            copies: 1,
            lines: sorted(racks),
          },
        ]),
  ];
}
