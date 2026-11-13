/**
 * The stock parts' list read (ADR-059). A ship's ports name the part fitted in each, with its type;
 * the rebuild asks the wiki's item list for exactly those types, placeholders included, instead
 * of reading every part on its own.
 */
import { z } from "zod";
import { WikiItem, type WikiPort, type WikiVehicle } from "./types.js";

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

/**
 * One page of that list, each record checked on its own: a record the item schema refuses (one
 * of the many placeholders no ship uses, say) is left out and counted, and a stock part among
 * them is read alone instead, so one odd record never halts the rebuild. The page itself must
 * say how many pages there are.
 */
export function stockPage(json: unknown): {
  records: Record<string, unknown>[];
  lastPage: number;
  refused: number;
} {
  const page = StockPage.parse(json);
  const records: Record<string, unknown>[] = [];
  let refused = 0;
  for (const record of page.data) {
    if (WikiItem.safeParse(record).success)
      records.push(record as Record<string, unknown>);
    else refused += 1;
  }
  return { records, lastPage: page.meta.last_page, refused };
}

const StockPage = z.looseObject({
  data: z.array(z.unknown()),
  meta: z.looseObject({ last_page: z.number().int().positive() }),
});

/** A listed record stands for a stock part only when it is that part, for the pack's build. */
export function takeFromList(
  record: Record<string, unknown> | undefined,
  className: string,
  version: string,
): record is Record<string, unknown> {
  return (
    record !== undefined &&
    record["class_name"] === className &&
    record["version"] === version
  );
}
