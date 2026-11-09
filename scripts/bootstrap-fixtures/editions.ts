import type { Vehicle } from "schema";

/**
 * Editions (ADR-022): the build carries vehicles that share another vehicle's display name and
 * maker, with a class name that extends the other's: showroom copies (`_Display`), sale editions
 * (`_BIS2950`, `_GS`, `_Plat`), collector and event editions. The ship matrix lists one ship for
 * them, and the data model has a place for the relation (`base_variant_of`: variants point at
 * their base), which the Wiki API does not expose. The rule here reads the relation off the
 * identifiers: within the vehicles of one maker and one name, a vehicle's base is the longest
 * other class name that is a proper prefix of its own at an underscore. Nothing else changes:
 * every edition keeps its record, stats and ports. A same-name vehicle with no such base stays
 * unlinked and is reported, never guessed.
 */
export interface EditionLinks {
  readonly vehicles: Vehicle[];
  /** Each edition and the base it now points at. */
  readonly editions: readonly { class_name: string; base: string }[];
  /** Vehicles that share a name and maker with another but extend no other's class name. */
  readonly unlinked: readonly string[];
}

export function linkEditions(vehicles: readonly Vehicle[]): EditionLinks {
  const groups = new Map<string, Vehicle[]>();
  for (const v of vehicles) {
    const key = `${v.manufacturer_code}\u0000${v.name}`;
    const list = groups.get(key) ?? [];
    list.push(v);
    groups.set(key, list);
  }
  const baseOf = new Map<string, string>();
  const unlinked: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const v of group) {
      const bases = group
        .filter(
          (o) =>
            o.class_name !== v.class_name &&
            v.class_name.startsWith(`${o.class_name}_`),
        )
        .sort((a, b) => b.class_name.length - a.class_name.length);
      const base = bases[0];
      if (base !== undefined) baseOf.set(v.class_name, base.class_name);
    }
    // A group whose members extend no other member: nothing links them.
    const linked = group.filter((v) => baseOf.has(v.class_name));
    if (linked.length === 0) unlinked.push(...group.map((v) => v.class_name));
  }
  const editions = [...baseOf]
    .map(([class_name, base]) => ({ class_name, base }))
    .sort((a, b) => a.class_name.localeCompare(b.class_name));
  return {
    vehicles: vehicles.map((v) =>
      baseOf.has(v.class_name)
        ? { ...v, base_variant_of: baseOf.get(v.class_name)! }
        : v,
    ),
    editions,
    unlinked: unlinked.sort(),
  };
}
