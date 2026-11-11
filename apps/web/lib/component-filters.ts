import type { Item, Manufacturer } from "schema";
import type { FacetOption, Query } from "./ship-filters";

/**
 * The components index's URL state (spec 02, "Component index and pages"): size and manufacturer
 * filters over the type-grouped list. Pure, unit-tested against the fixture pack.
 */

export interface IndexComponent {
  readonly item: Item;
  readonly manufacturer: Manufacturer | null;
}

export const COMPONENT_FACETS = ["size", "manufacturer"] as const;
export type ComponentFacet = (typeof COMPONENT_FACETS)[number];
export type ComponentFilters = Readonly<
  Partial<Record<ComponentFacet, string>>
>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** The manufacturer's slug; null (a missing row, which parsePack prevents) matches no filter. */
export function componentManufacturerValue(c: IndexComponent): string | null {
  return c.manufacturer?.slug ?? null;
}

export function parseComponentQuery(query: Query): ComponentFilters {
  const filters: Partial<Record<ComponentFacet, string>> = {};
  for (const facet of COMPONENT_FACETS) {
    const value = first(query[facet])?.trim();
    if (value !== undefined && value !== "") filters[facet] = value;
  }
  return filters;
}

export function matchesComponentFilters(
  c: IndexComponent,
  filters: ComponentFilters,
): boolean {
  if (filters.size !== undefined && String(c.item.size) !== filters.size) {
    return false;
  }
  if (
    filters.manufacturer !== undefined &&
    componentManufacturerValue(c) !== filters.manufacturer
  ) {
    return false;
  }
  return true;
}

export function applyComponentFilters<T extends IndexComponent>(
  components: readonly T[],
  filters: ComponentFilters,
): readonly T[] {
  return components.filter((c) => matchesComponentFilters(c, filters));
}

/** Every size and manufacturer present among `components`, from the data. */
export function componentFacetOptions(
  components: readonly IndexComponent[],
): Readonly<Record<ComponentFacet, readonly FacetOption[]>> {
  const sizes = new Set<number>();
  const manufacturers = new Map<string, string>();
  for (const c of components) {
    sizes.add(c.item.size);
    if (c.manufacturer !== null) {
      manufacturers.set(c.manufacturer.slug, c.manufacturer.name);
    }
  }
  return {
    size: [...sizes]
      .sort((a, b) => a - b)
      .map((size) => ({ value: String(size), label: `Size ${size}` })),
    manufacturer: [...manufacturers]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "en")),
  };
}

/**
 * Parts a ship comes with and players do not swap (owner, 2026-11-11, ADR-046): thrusters and fuel
 * intakes, over 40% of the parts on record. The index leaves them out unless `?fixed=shown`.
 */
export const FIXED_TYPES: ReadonlySet<string> = new Set([
  "thruster",
  "fuel_intake",
]);

export function parseFixedShown(query: Query): boolean {
  return first(query["fixed"])?.trim() === "shown";
}

export function withoutFixed<T extends IndexComponent>(
  components: readonly T[],
  shown: boolean,
): readonly T[] {
  return shown
    ? components
    : components.filter((c) => !FIXED_TYPES.has(c.item.type));
}

export function hasComponentFilters(filters: ComponentFilters): boolean {
  return COMPONENT_FACETS.some((facet) => filters[facet] !== undefined);
}

export function componentIndexHref(
  filters: ComponentFilters,
  fixedShown = false,
): string {
  const params = new URLSearchParams();
  for (const facet of COMPONENT_FACETS) {
    const value = filters[facet];
    if (value !== undefined) params.set(facet, value);
  }
  if (fixedShown) params.set("fixed", "shown");
  const query = params.toString();
  return query === "" ? "/components" : `/components?${query}`;
}
