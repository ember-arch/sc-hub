import type { Manufacturer, Vehicle, VehicleStats } from "schema";

/**
 * The ships index's URL state (spec 02, "Ship index"): five filters and a view, parsed from the
 * query string and applied to the ship list. Pure, so it is unit-tested against the fixture pack.
 * Facet values are derived from the data (never typed in): manufacturer slugs, kebab-cased roles,
 * the size classes, statuses and kinds the ships actually have.
 */

export interface IndexShip {
  readonly vehicle: Vehicle;
  readonly stats: VehicleStats | null;
  readonly manufacturer: Manufacturer | null;
}

export const SHIP_FACETS = [
  "manufacturer",
  "role",
  "size",
  "status",
  "kind",
] as const;
export type ShipFacet = (typeof SHIP_FACETS)[number];

export type ShipFilters = Readonly<Partial<Record<ShipFacet, string>>>;

export const SHIP_VIEWS = ["cards", "table"] as const;
export type ShipView = (typeof SHIP_VIEWS)[number];

export interface ShipIndexState {
  readonly filters: ShipFilters;
  readonly view: ShipView;
}

/** docs/data-model.md: vehicle, snub, small, medium, large, capital. Unknown classes sort after. */
const SIZE_ORDER: readonly string[] = [
  "vehicle",
  "snub",
  "small",
  "medium",
  "large",
  "capital",
];

export type Query = Readonly<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** `Light Freight, Medium Fighter` → `light-freight-medium-fighter`; also the facet value for a single role. */
export function facetValue(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The ship matrix lists several roles for some ships, comma-separated; each is its own facet value. */
export function rolesOf(vehicle: Vehicle): readonly string[] {
  if (vehicle.role === null) return [];
  return vehicle.role
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role !== "");
}

/** The manufacturer's slug when the pack knows it, the code otherwise. */
export function manufacturerValue(ship: IndexShip): string {
  return ship.manufacturer?.slug ?? ship.vehicle.manufacturer_code;
}

export function parseShipQuery(query: Query): ShipIndexState {
  const filters: Partial<Record<ShipFacet, string>> = {};
  for (const facet of SHIP_FACETS) {
    const value = first(query[facet])?.trim();
    if (value !== undefined && value !== "") filters[facet] = value;
  }
  const view = first(query["view"]);
  return {
    filters,
    view: view === "table" ? "table" : "cards",
  };
}

export function matchesShipFilters(
  ship: IndexShip,
  filters: ShipFilters,
): boolean {
  if (
    filters.manufacturer !== undefined &&
    manufacturerValue(ship) !== filters.manufacturer
  ) {
    return false;
  }
  if (
    filters.role !== undefined &&
    !rolesOf(ship.vehicle).some((role) => facetValue(role) === filters.role)
  ) {
    return false;
  }
  if (filters.size !== undefined && ship.vehicle.size_class !== filters.size) {
    return false;
  }
  if (filters.status !== undefined && ship.vehicle.status !== filters.status) {
    return false;
  }
  if (filters.kind !== undefined && ship.vehicle.kind !== filters.kind) {
    return false;
  }
  return true;
}

export function applyShipFilters<T extends IndexShip>(
  ships: readonly T[],
  filters: ShipFilters,
): readonly T[] {
  return ships.filter((ship) => matchesShipFilters(ship, filters));
}

export interface FacetOption {
  readonly value: string;
  readonly label: string;
}

const byLabel = (a: FacetOption, b: FacetOption): number =>
  a.label.localeCompare(b.label, "en");

/**
 * The options each filter offers: every value present among `ships` (the whole index, not the
 * filtered result, so a reader can widen a search), labelled from the data. Status and kind labels
 * come from the caller because their copy lives in `ui`.
 */
export function shipFacetOptions(
  ships: readonly IndexShip[],
  labels: {
    readonly status: (status: Vehicle["status"]) => string;
    readonly kind: (kind: Vehicle["kind"]) => string;
    readonly size: (size: string) => string;
  },
): Readonly<Record<ShipFacet, readonly FacetOption[]>> {
  const manufacturers = new Map<string, string>();
  const roles = new Map<string, string>();
  const sizes = new Set<string>();
  const statuses = new Set<Vehicle["status"]>();
  const kinds = new Set<Vehicle["kind"]>();
  for (const ship of ships) {
    manufacturers.set(
      manufacturerValue(ship),
      ship.manufacturer?.name ?? ship.vehicle.manufacturer_code,
    );
    for (const role of rolesOf(ship.vehicle)) roles.set(facetValue(role), role);
    if (ship.vehicle.size_class !== null) sizes.add(ship.vehicle.size_class);
    statuses.add(ship.vehicle.status);
    kinds.add(ship.vehicle.kind);
  }
  const sizeRank = (size: string): number => {
    const index = SIZE_ORDER.indexOf(size);
    return index < 0 ? SIZE_ORDER.length : index;
  };
  return {
    manufacturer: [...manufacturers]
      .map(([value, label]) => ({ value, label }))
      .sort(byLabel),
    role: [...roles].map(([value, label]) => ({ value, label })).sort(byLabel),
    size: [...sizes]
      .sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b, "en"))
      .map((value) => ({ value, label: labels.size(value) })),
    status: [...statuses]
      .map((value) => ({ value, label: labels.status(value) }))
      .sort(byLabel),
    kind: [...kinds]
      .map((value) => ({ value, label: labels.kind(value) }))
      .sort(byLabel),
  };
}

export function hasShipFilters(filters: ShipFilters): boolean {
  return SHIP_FACETS.some((facet) => filters[facet] !== undefined);
}

/** `/ships?...` for a state; the default view and empty filters leave no trace in the URL. */
export function shipIndexHref(state: ShipIndexState): string {
  const params = new URLSearchParams();
  for (const facet of SHIP_FACETS) {
    const value = state.filters[facet];
    if (value !== undefined) params.set(facet, value);
  }
  if (state.view !== "cards") params.set("view", state.view);
  const query = params.toString();
  return query === "" ? "/ships" : `/ships?${query}`;
}
