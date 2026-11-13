/**
 * The stock parts' list read (ADR-059). A ship's ports name the part fitted in each, with its type;
 * the rebuild asks the wiki's item list for exactly those types, placeholders included, instead
 * of reading every part on its own.
 */
import type { WikiPort, WikiVehicle } from "./types.js";

/** The types of the stock parts the ports name, sorted, each once. */
export function stockTypesOf(
  vehicles: readonly Pick<WikiVehicle, "ports">[],
  stock: ReadonlyMap<string, string>,
): string[] {
  const types = new Set<string>();
  const walk = (ports: readonly WikiPort[] | null | undefined): void => {
    for (const port of ports ?? []) {
      const item = port.equipped_item;
      if (
        item !== null &&
        item !== undefined &&
        item.type !== "" &&
        stock.has(item.class_name)
      )
        types.add(item.type);
      walk(port.ports);
    }
  };
  for (const v of vehicles) walk(v.ports);
  return [...types].sort();
}

/**
 * One page of the item list for those types. `filter[type]` takes several types at once, and
 * `filter[include_irrelevant]` keeps the parts the wiki names "<= PLACEHOLDER =>", which most
 * ship-specific thrusters, fuel intakes and armour are.
 */
export function stockListPath(types: readonly string[], page: number): string {
  return `/api/items?filter[type]=${types.join(",")}&filter[include_irrelevant]=true&page[size]=200&page[number]=${page}`;
}
