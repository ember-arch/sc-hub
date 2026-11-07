import { type CardProps, type KeyFact, formatNumber, sentence } from "ui";
import type { ComponentView, ShipView } from "./data";

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
