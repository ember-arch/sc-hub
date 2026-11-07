import { sentence, vehicleStatusBadge } from "ui";
import type {
  CompareColumn,
  CompareGroup,
  CompareRow,
} from "../app/compare/compare-table";
import { compareHref, withoutShip } from "./compare";
import type { ShipView } from "./data";
import { crewRange } from "./views";

/**
 * Rows for the compare page (spec 02, "Compare"): the key-facts set first, then the full stats
 * table, one column per ship. A row every ship lacks is omitted (spec 02 notes: omit null rows).
 */

export function compareColumns(ships: readonly ShipView[]): CompareColumn[] {
  const slugs = ships.map((s) => s.vehicle.slug);
  return ships.map((ship) => ({
    slug: ship.vehicle.slug,
    name: ship.vehicle.name,
    href: `/ships/${ship.vehicle.slug}`,
    removeHref: compareHref(withoutShip(slugs, ship.vehicle.slug)),
  }));
}

type Value = number | string | null;

interface RowSpec {
  readonly key: string;
  readonly label: string;
  readonly unit?: string | undefined;
  readonly digits?: 0 | 2 | undefined;
  readonly value: (ship: ShipView) => Value;
}

const KEY_FACTS: readonly RowSpec[] = [
  {
    key: "manufacturer",
    label: "Manufacturer",
    value: (s) => s.manufacturer?.name ?? s.vehicle.manufacturer_code,
  },
  { key: "role", label: "Role", value: (s) => s.vehicle.role },
  {
    key: "size",
    label: "Size",
    value: (s) =>
      s.vehicle.size_class === null ? null : sentence(s.vehicle.size_class),
  },
  {
    key: "crew",
    label: "Crew",
    value: (s) =>
      s.stats === null ? null : crewRange(s.stats.crew_min, s.stats.crew_max),
  },
  {
    key: "cargo",
    label: "Cargo",
    unit: "SCU",
    value: (s) => s.stats?.cargo_scu ?? null,
  },
  {
    key: "length",
    label: "Length",
    unit: "m",
    digits: 2,
    value: (s) => s.stats?.length_m ?? null,
  },
  {
    key: "mass",
    label: "Mass",
    unit: "kg",
    value: (s) => s.stats?.mass_kg ?? null,
  },
  {
    key: "status",
    label: "Status",
    value: (s) => vehicleStatusBadge(s.vehicle.status).label,
  },
];

const STATS: readonly RowSpec[] = [
  {
    key: "beam",
    label: "Beam",
    unit: "m",
    digits: 2,
    value: (s) => s.stats?.beam_m ?? null,
  },
  {
    key: "height",
    label: "Height",
    unit: "m",
    digits: 2,
    value: (s) => s.stats?.height_m ?? null,
  },
  {
    key: "hull",
    label: "Hull",
    unit: "HP",
    value: (s) => s.stats?.hull_hp ?? null,
  },
  {
    key: "scm",
    label: "SCM speed",
    unit: "m/s",
    value: (s) => s.stats?.scm_speed ?? null,
  },
  {
    key: "nav",
    label: "NAV speed",
    unit: "m/s",
    value: (s) => s.stats?.nav_speed ?? null,
  },
  // The data model gives the fuel fields no unit yet (ADR-006).
  {
    key: "hydrogen-fuel",
    label: "Hydrogen fuel",
    digits: 2,
    value: (s) => s.stats?.hydrogen_fuel ?? null,
  },
  {
    key: "hydrogen-capacity",
    label: "Hydrogen capacity",
    digits: 2,
    value: (s) => s.stats?.hydrogen_capacity ?? null,
  },
  {
    key: "quantum-fuel",
    label: "Quantum fuel",
    digits: 2,
    value: (s) => s.stats?.quantum_fuel ?? null,
  },
  {
    key: "quantum-capacity",
    label: "Quantum capacity",
    digits: 2,
    value: (s) => s.stats?.quantum_capacity ?? null,
  },
];

function rows(specs: readonly RowSpec[], ships: readonly ShipView[]) {
  return specs
    .map((spec): CompareRow => ({
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      digits: spec.digits,
      values: ships.map(spec.value),
    }))
    .filter((row) => row.values.some((v) => v !== null));
}

export function compareGroups(ships: readonly ShipView[]): CompareGroup[] {
  return [
    { title: "Key facts", rows: rows(KEY_FACTS, ships) },
    { title: "Specifications", rows: rows(STATS, ships) },
  ].filter((group) => group.rows.length > 0);
}
