import { sentence, vehicleStatusBadge } from "ui";
import type {
  CompareColumn,
  CompareGroup,
  CompareRow,
} from "../app/compare/compare-table";
import { pricesFor } from "./acquisition";
import { compareHref, withoutShip } from "./compare";
import type { ShipView } from "./data";
import { insuranceOf } from "./ship-file";
import { VEHICLE_STATS, crewRange } from "./views";

/**
 * Rows for the compare page (spec 02, "Compare"): the key-facts set first, then prices and
 * insurance (ADR-013), then every other VehicleStats field from the ship page's own field table,
 * one column per ship. A row every ship
 * lacks is omitted (spec 02 notes: omit null rows); a ship missing a stat the others have shows a
 * dash in the table.
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
  readonly mono?: boolean | undefined;
  readonly value: (ship: ShipView) => Value;
}

/** The key-facts set with manufacturer and status, which compare has no hero for (ADR-007). */
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
    mono: true,
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

const prices = (s: ShipView) => pricesFor(s.vehicle.slug, s.vehicle.class_name);

/**
 * Prices and insurance for acquisition planning (ADR-013): the pledge store, UEX Corp's lowest
 * reported shop prices and the game's insurance figures. The page credits both price sources.
 */
const ACQUISITION: readonly RowSpec[] = [
  {
    key: "pledge",
    label: "Pledge",
    unit: "USD",
    value: (s) => prices(s).pledge?.price_usd ?? null,
  },
  {
    key: "pledge_status",
    label: "Pledge status",
    value: (s) => {
      const pledge = prices(s).pledge;
      if (pledge === null) return null;
      return pledge.available ? "On sale" : "Not on sale";
    },
  },
  {
    key: "buy",
    label: "Buy in game, lowest",
    unit: "aUEC",
    value: (s) => prices(s).buy_auec,
  },
  {
    key: "rent",
    label: "Rent in game, lowest",
    unit: "aUEC",
    value: (s) => prices(s).rent_auec,
  },
  {
    key: "insurance_claim",
    label: "Insurance claim",
    unit: "min",
    digits: 2,
    value: (s) => insuranceOf(s.stats?.raw)?.claim_min ?? null,
  },
  {
    key: "expedite_fee",
    label: "Expedite fee",
    unit: "aUEC",
    value: (s) => insuranceOf(s.stats?.raw)?.expedite_auec ?? null,
  },
];

/** The stats the key facts already cover; everything else in VEHICLE_STATS makes the second group. */
const IN_KEY_FACTS = new Set<string>(["cargo_scu", "length_m", "mass_kg"]);

const STATS: readonly RowSpec[] = VEHICLE_STATS.filter(
  (spec) => !IN_KEY_FACTS.has(spec.key),
).map((spec) => ({
  key: spec.key,
  label: spec.label,
  unit: spec.unit,
  digits: spec.digits,
  value: (s) => s.stats?.[spec.key] ?? null,
}));

function rows(specs: readonly RowSpec[], ships: readonly ShipView[]) {
  return specs
    .map((spec): CompareRow => ({
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      digits: spec.digits,
      mono: spec.mono,
      values: ships.map(spec.value),
    }))
    .filter((row) => row.values.some((v) => v !== null));
}

export function compareGroups(ships: readonly ShipView[]): CompareGroup[] {
  return [
    { title: "Key facts", rows: rows(KEY_FACTS, ships) },
    { title: "Acquisition", rows: rows(ACQUISITION, ships) },
    { title: "Specifications", rows: rows(STATS, ships) },
  ].filter((group) => group.rows.length > 0);
}
