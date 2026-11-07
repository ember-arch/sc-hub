import { sizeClassRank } from "schema";
import {
  type CardProps,
  type ChannelStatRow,
  type KeyFact,
  formatNumber,
  sentence,
  vehicleStatusBadge,
} from "ui";
import type { ItemStats, VehicleStats } from "schema";
import type { ShipRow } from "../app/ships/ship-table";
import { type Deltas, channelDeltas } from "./channel-diff";
import type { ComponentView, ShipView } from "./data";

type NumericKey<T> = {
  [K in keyof T]: T[K] extends number | null ? K : never;
}[keyof T];

export interface StatSpec<T> {
  readonly key: NumericKey<T>;
  readonly label: string;
  readonly unit?: string | undefined;
  readonly digits?: 0 | 2 | undefined;
}

/** Every VehicleStats field the ship page and compare show, with its unit; null fields are omitted (spec 02 notes). */
export const VEHICLE_STATS: readonly StatSpec<VehicleStats>[] = [
  { key: "length_m", label: "Length", unit: "m", digits: 2 },
  { key: "beam_m", label: "Beam", unit: "m", digits: 2 },
  { key: "height_m", label: "Height", unit: "m", digits: 2 },
  { key: "mass_kg", label: "Mass", unit: "kg" },
  { key: "cargo_scu", label: "Cargo", unit: "SCU" },
  { key: "hull_hp", label: "Hull", unit: "HP" },
  { key: "scm_speed", label: "SCM speed", unit: "m/s" },
  { key: "nav_speed", label: "NAV speed", unit: "m/s" },
  // The data model gives the fuel fields no unit yet; they show none rather than a guessed one.
  { key: "hydrogen_fuel", label: "Hydrogen fuel", digits: 2 },
  { key: "hydrogen_capacity", label: "Hydrogen capacity", digits: 2 },
  { key: "quantum_fuel", label: "Quantum fuel", digits: 2 },
  { key: "quantum_capacity", label: "Quantum capacity", digits: 2 },
];

/** Every ItemStats field; the type-specific ones stay null for other types and are omitted. */
const ITEM_STATS: readonly StatSpec<ItemStats>[] = [
  { key: "hp", label: "Health", digits: 2 },
  { key: "power_draw", label: "Power draw", digits: 2 },
  { key: "power_output", label: "Power output", digits: 2 },
  { key: "heat_generation", label: "Heat generation", digits: 2 },
  { key: "cooling_rate", label: "Cooling rate", digits: 2 },
  { key: "em_signature", label: "EM signature", digits: 2 },
  { key: "ir_signature", label: "IR signature", digits: 2 },
  { key: "weapon_damage", label: "Damage", digits: 2 },
  { key: "weapon_fire_rate", label: "Fire rate", digits: 2 },
  { key: "weapon_range", label: "Range", digits: 2 },
  { key: "projectile_speed", label: "Projectile speed", digits: 2 },
  { key: "shield_hp", label: "Shield health", digits: 2 },
  { key: "shield_regen", label: "Shield regeneration", digits: 2 },
  { key: "shield_delay", label: "Shield delay", digits: 2 },
  { key: "qd_speed", label: "Quantum speed", digits: 2 },
  { key: "qd_range", label: "Quantum range", digits: 2 },
  { key: "qd_fuel_per_jump", label: "Fuel per jump", digits: 2 },
  { key: "qd_spool_time", label: "Spool time", digits: 2 },
];

function channelRows<T extends object>(
  specs: readonly StatSpec<T>[],
  live: T,
  ptu: T | null,
): ChannelStatRow[] {
  const deltas: Deltas<T> = channelDeltas(live, ptu);
  return specs
    .filter((spec) => live[spec.key] !== null)
    .map((spec) => ({
      key: String(spec.key),
      label: spec.label,
      value: live[spec.key] as number | null,
      unit: spec.unit,
      digits: spec.digits,
      delta: deltas[spec.key],
    }));
}

/** Specification rows for StatsByChannel: LIVE values, PTU deltas where the PTU row differs, crew last. */
export function shipSpecRows(ship: ShipView): ChannelStatRow[] {
  const s = ship.stats;
  if (s === null) return [];
  const rows = channelRows(VEHICLE_STATS, s, ship.ptu);
  const crew: ChannelStatRow = {
    key: "crew",
    label: "Crew",
    value: crewRange(s.crew_min, s.crew_max),
    delta:
      ship.ptu !== null && ship.ptu.crew_max !== s.crew_max
        ? ship.ptu.crew_max - s.crew_max
        : undefined,
  };
  return [...rows, crew];
}

export function componentStatRows(c: ComponentView): ChannelStatRow[] {
  return c.stats === null ? [] : channelRows(ITEM_STATS, c.stats, c.ptu);
}

/** Rows for the ships index table; sorting happens in the table from the numeric fields. */
export function shipRows(ships: readonly ShipView[]): readonly ShipRow[] {
  return ships.map((ship) => {
    const s = ship.stats;
    return {
      key: ship.vehicle.class_name,
      slug: ship.vehicle.slug,
      name: ship.vehicle.name,
      href: `/ships/${ship.vehicle.slug}`,
      manufacturer: ship.manufacturer?.name ?? ship.vehicle.manufacturer_code,
      role: ship.vehicle.role,
      size:
        ship.vehicle.size_class === null
          ? null
          : sentence(ship.vehicle.size_class),
      sizeRank: sizeClassRank(ship.vehicle.size_class),
      crew: s === null ? null : crewRange(s.crew_min, s.crew_max),
      crewMax: s?.crew_max ?? null,
      cargo: s?.cargo_scu ?? null,
      length: s?.length_m ?? null,
      mass: s?.mass_kg ?? null,
      scmSpeed: s?.scm_speed ?? null,
      status: vehicleStatusBadge(ship.vehicle.status).label,
    };
  });
}

/** Props shared by the ship index, related groups and manufacturer lineups. */
export function shipCard(ship: ShipView): CardProps {
  return {
    href: `/ships/${ship.vehicle.slug}`,
    name: ship.vehicle.name,
    manufacturer: ship.manufacturer?.name ?? ship.vehicle.manufacturer_code,
    role: ship.vehicle.role,
    stats: [
      {
        label: "Crew",
        value:
          ship.stats === null
            ? null
            : crewRange(ship.stats.crew_min, ship.stats.crew_max),
      },
      { label: "Cargo", value: ship.stats?.cargo_scu ?? null, unit: "SCU" },
    ],
    image: null,
  };
}

export function crewRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

/** Key facts: manufacturer, role, size, crew, cargo, length, mass, status (system.md section 4). */
export function shipFacts(ship: ShipView, statusLabel: string): KeyFact[] {
  const s = ship.stats;
  return [
    {
      label: "Manufacturer",
      value: ship.manufacturer?.name ?? ship.vehicle.manufacturer_code,
    },
    { label: "Role", value: ship.vehicle.role },
    {
      label: "Size",
      value:
        ship.vehicle.size_class === null
          ? null
          : sentence(ship.vehicle.size_class),
    },
    {
      label: "Crew",
      value: s === null ? null : crewRange(s.crew_min, s.crew_max),
    },
    { label: "Cargo", value: s?.cargo_scu ?? null, unit: "SCU" },
    {
      label: "Length",
      value: s === null ? null : formatNumber(s.length_m, 2),
      unit: "m",
    },
    {
      label: "Mass",
      value: s === null ? null : formatNumber(s.mass_kg),
      unit: "kg",
    },
    { label: "Status", value: statusLabel },
  ];
}

export function componentFacts(c: ComponentView): KeyFact[] {
  return [
    { label: "Type", value: sentence(c.item.type) },
    { label: "Size", value: c.item.size },
    { label: "Grade", value: c.item.grade },
    {
      label: "Class",
      value: c.item.item_class === null ? null : sentence(c.item.item_class),
    },
    {
      label: "Manufacturer",
      value: c.manufacturer?.name ?? c.item.manufacturer_code,
    },
  ];
}

export function componentCard(c: ComponentView): CardProps {
  return {
    href: `/components/${c.item.slug}`,
    name: c.item.name,
    manufacturer: c.manufacturer?.name ?? c.item.manufacturer_code,
    role: sentence(c.item.type),
    stats: [
      { label: "Size", value: c.item.size },
      { label: "Grade", value: c.item.grade },
    ],
    image: null,
  };
}

/** Rows for ComponentTable on the components index and manufacturer pages. */
export function componentRows(components: readonly ComponentView[]) {
  return components.map((c) => ({
    key: c.item.class_name,
    name: c.item.name,
    href: `/components/${c.item.slug}`,
    manufacturer: c.manufacturer?.name ?? c.item.manufacturer_code,
    size: c.item.size,
    grade: c.item.grade,
    itemClass: c.item.item_class === null ? null : sentence(c.item.item_class),
  }));
}
