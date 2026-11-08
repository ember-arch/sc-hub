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
