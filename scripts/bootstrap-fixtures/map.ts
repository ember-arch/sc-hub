import { randomUUID } from "node:crypto";
import {
  type Channel,
  GameVersion,
  Item,
  ItemStats,
  ItemType,
  Manufacturer,
  Port,
  type PortType,
  Vehicle,
  type VehicleKind,
  VehicleStats,
  type VehicleStatus,
} from "schema";
import { describeIssues } from "schema/pack";
import type { z } from "zod";
import { MapError } from "./errors.js";
import { type Named, assignSlugs } from "./slugs.js";
import type {
  WikiItem,
  WikiManufacturer,
  WikiPort,
  WikiText,
  WikiVehicle,
} from "./types.js";

/**
 * Pure functions from wiki API shapes to the entities in docs/data-model.md. Every value comes
 * from the API; the tables below map the API's own vocabulary onto the model's enumerations and
 * are the only "knowledge" this file adds. Anything the tables do not cover halts (ADR-002 rule 5);
 * nothing is defaulted, converted or inferred.
 */

export { MapError } from "./errors.js";
export { assignSlugs, slugify, type Named } from "./slugs.js";

// ---------------------------------------------------------------------------
// Vocabulary tables
// ---------------------------------------------------------------------------

export type TypeOutcome =
  | { readonly outcome: "map"; readonly portType: PortType }
  | { readonly outcome: "other" }
  | { readonly outcome: "exclude" }
  | { readonly outcome: "unknown" };

/** Wiki `type` strings that name a hardpoint or component kind in the data model. */
export const TYPE_MAP: Readonly<Record<string, PortType>> = {
  WeaponGun: "weapon",
  Turret: "turret",
  TurretBase: "turret",
  MissileLauncher: "missile_rack",
  Missile: "missile",
  Shield: "shield",
  PowerPlant: "power_plant",
  Cooler: "cooler",
  QuantumDrive: "quantum_drive",
  Radar: "radar",
  FuelTank: "fuel_tank",
  QuantumFuelTank: "fuel_tank",
  FuelIntake: "fuel_intake",
  JumpDrive: "jump_module",
  MainThruster: "thruster",
  ManneuverThruster: "thruster",
  Armor: "armor",
  MiningLaser: "mining_laser",
  TractorBeam: "tractor_beam",
  WeaponDefensive: "countermeasure",
  Paints: "paint",
  Cargo: "cargo_grid",
  CargoGrid: "cargo_grid",
};

/**
 * Ports kept as `other`: real ports on the vehicle that are not a component slot the model names.
 * LifeSupportGenerator is a component the data model has no kind for yet; Phase 1 decides.
 */
export const TYPE_OTHER: ReadonlySet<string> = new Set([
  "WeaponAttachment",
  "LifeSupportGenerator",
  "Misc",
  "",
]);

/** Structure, interior fittings and controllers: not hardpoints. No row, no item fetch, counted in the report. */
export const TYPE_EXCLUDE: ReadonlySet<string> = new Set([
  "AIModule",
  "AttachedPart",
  "DockingAnimator",
  "Room",
  "Usable",
  "Display",
  "DockingCollar",
  "Door",
  "LandingSystem",
  "Relay",
  "SelfDestruct",
]);

export function classifyType(type: string): TypeOutcome {
  const mapped = TYPE_MAP[type];
  if (mapped !== undefined) return { outcome: "map", portType: mapped };
  if (TYPE_OTHER.has(type)) return { outcome: "other" };
  if (
    TYPE_EXCLUDE.has(type) ||
    type.endsWith("Controller") ||
    type.startsWith("Seat")
  ) {
    return { outcome: "exclude" };
  }
  return { outcome: "unknown" };
}

/** Component kinds: a port of one of these carries a stock item that becomes an Item row. */
export function isComponentType(portType: PortType): portType is ItemType {
  return portType !== "other" && ItemType.safeParse(portType).success;
}

const STATUS_MAP: Readonly<Record<string, VehicleStatus>> = {
  "flight-ready": "flight_ready",
  "in-production": "in_production",
  "in-concept": "concept",
  concept: "concept",
};

const SIZE_CLASSES: ReadonlySet<string> = new Set([
  "vehicle",
  "snub",
  "small",
  "medium",
  "large",
  "capital",
]);

const CHANNEL_MAP: Readonly<Record<string, Channel>> = {
  live: "LIVE",
  ptu: "PTU",
  eptu: "EPTU",
};

/** Keys dropped from a vehicle's `raw` remainder: mapped elsewhere, derived, or too large. */
export const VEHICLE_RAW_DROP: ReadonlySet<string> = new Set([
  "ports",
  "components",
  "parts",
  "turrets",
  "shops",
  "images",
  "loaner",
  "skus",
  "uex_prices",
  "curated_data",
  "relay_network",
  "power_pools",
  "weaponry",
  "weapon_snapshot",
  "damage_limits",
  "description",
  "game_description",
  "msrp",
  "warbond_price",
  "pledge_url",
  "web_url",
  "link",
  "manufacturer",
]);

/** Keys dropped from an item's `raw` remainder. */
export const ITEM_RAW_DROP: ReadonlySet<string> = new Set([
  "uex_prices",
  "type_web_url",
  "shops",
  "images",
  "variants",
  "related_items",
  "blueprints",
  "vehicles",
  "description",
  "description_data",
  "web_url",
  "link",
  "ports",
  "manufacturer",
]);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** English text out of a wiki localized value; null when there is none. */
export function en(value: WikiText | number | null | undefined): string | null {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const text = value.en_EN;
    return typeof text === "string" ? text : null;
  }
  return null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requireNumber(
  value: number | null | undefined,
  path: string,
  context: string,
): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new MapError(
    `${context}: ${path} is required by the data model but the API returned ${JSON.stringify(value ?? null)}`,
    { context, path },
  );
}

function requireInt(
  value: number | null | undefined,
  path: string,
  context: string,
): number {
  const number = requireNumber(value, path, context);
  if (!Number.isInteger(number)) {
    throw new MapError(
      `${context}: ${path} must be an integer, got ${number}`,
      {
        context,
        path,
      },
    );
  }
  return number;
}

/** The vehicle record is authoritative; ports and items only have to agree when they carry a version. */
function requireVersion(
  value: string | null | undefined,
  expected: string,
  context: string,
): string {
  if (typeof value === "string" && value.length > 0 && value !== expected) {
    throw new MapError(
      `${context}: version ${JSON.stringify(value)} differs from the pack version ${expected}`,
      { context, path: "version" },
    );
  }
  return expected;
}

function text(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseEntity<T extends z.ZodType>(
  schema: T,
  entity: string,
  context: string,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new MapError(
      `${context}: mapped ${entity} fails the contract: ${describeIssues(result.error)}`,
      { entity, context },
    );
  }
  return result.data;
}

const LOCALE_KEY = /^[a-z]{2}_[A-Z]{2}$/;

/** Replaces every locale-keyed object (`{ en_EN, de_DE, ... }`) with its English text, recursively. */
export function collapseLocales(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(collapseLocales);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.entries(record);
    if (entries.length > 0 && entries.every(([key]) => LOCALE_KEY.test(key))) {
      return record["en_EN"] ?? null;
    }
    return Object.fromEntries(
      entries.map(([key, inner]) => [key, collapseLocales(inner)]),
    );
  }
  return value;
}

/** The normalized-but-unmapped remainder of a record (data-model principle 4). */
export function pruneRaw(
  source: Record<string, unknown>,
  drop: ReadonlySet<string>,
): Record<string, unknown> {
  const kept = Object.fromEntries(
    Object.entries(source).filter(([key]) => !drop.has(key)),
  );
  return collapseLocales(kept) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Entity mappers
// ---------------------------------------------------------------------------

export function mapChannel(raw: string): Channel {
  const channel = CHANNEL_MAP[raw.toLowerCase()];
  if (channel === undefined) {
    throw new MapError(`unknown channel ${JSON.stringify(raw)}`, { raw });
  }
  return channel;
}

export function mapGameVersion(
  raw: { code: string; channel: string },
  now: string,
  manifestUrl: string,
  id: string = randomUUID(),
): GameVersion {
  return parseEntity(GameVersion, "GameVersion", `game version ${raw.code}`, {
    id,
    channel: mapChannel(raw.channel),
    version: raw.code,
    detected_at: now,
    // The bootstrap pack is its own publish; this is pipeline metadata, not game data.
    published_at: now,
    manifest_url: manifestUrl,
    is_current: true,
  });
}

export function mapManufacturers(
  sources: readonly WikiManufacturer[],
): Manufacturer[] {
  const names = new Map<string, string>();
  for (const source of sources) {
    const existing = names.get(source.code);
    if (existing !== undefined && existing !== source.name) {
      throw new MapError(
        `manufacturer ${source.code} has two names: ${existing} and ${source.name}`,
        { code: source.code },
      );
    }
    names.set(source.code, source.name);
  }
  const named: Named[] = [...names].map(([code, name]) => ({
    class_name: code,
    name,
    manufacturer_code: code,
  }));
  const slugs = assignSlugs(named);
  return named
    .map(({ class_name: code, name }) =>
      parseEntity(Manufacturer, "Manufacturer", `manufacturer ${code}`, {
        code,
        name,
        slug: slugs.get(code),
        // Fankit or localization copy only; never invented. Empty until one of those exists.
        description: "",
        logo_asset: null,
      }),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function mapStatus(raw: WikiVehicle): VehicleStatus {
  const value = en(raw.production_status);
  const status = value === null ? undefined : STATUS_MAP[value.toLowerCase()];
  if (status === undefined) {
    throw new MapError(
      `vehicle ${raw.class_name}: production status ${JSON.stringify(value)} is not in the status table`,
      { class_name: raw.class_name, value },
    );
  }
  return status;
}

export function mapSizeClass(raw: WikiVehicle): string {
  const value = en(raw.size)?.toLowerCase();
  if (value === undefined || !SIZE_CLASSES.has(value)) {
    throw new MapError(
      `vehicle ${raw.class_name}: size ${JSON.stringify(value ?? raw.size ?? null)} is not one of the data model's size classes`,
      { class_name: raw.class_name, value },
    );
  }
  return value;
}

export function mapKind(raw: WikiVehicle): VehicleKind {
  if (raw.is_spaceship === true) return "ship";
  if (raw.is_vehicle === true || raw.is_gravlev === true)
    return "ground_vehicle";
  throw new MapError(
    `vehicle ${raw.class_name}: the API does not say whether it is a ship or a ground vehicle`,
    { class_name: raw.class_name },
  );
}

export function mapVehicle(
  raw: WikiVehicle,
  slug: string,
  version: string,
): Vehicle {
  const context = `vehicle ${raw.class_name}`;
  const foci = (raw.foci ?? [])
    .map((focus) => en(focus))
    .filter((focus): focus is string => focus !== null && focus.length > 0);
  return parseEntity(Vehicle, "Vehicle", context, {
    class_name: raw.class_name,
    slug,
    name: raw.name,
    manufacturer_code: raw.manufacturer.code,
    kind: mapKind(raw),
    status: mapStatus(raw),
    role: foci.length > 0 ? foci.join(", ") : null,
    size_class: mapSizeClass(raw),
    // The API exposes no base-variant relation; variants stay unlinked in the bootstrap pack.
    base_variant_of: null,
    is_hero: false,
    first_seen_version: requireVersion(raw.version, version, context),
    slug_history: [],
  });
}

export function mapVehicleStats(
  raw: WikiVehicle,
  channel: Channel,
  version: string,
): VehicleStats {
  const context = `vehicle ${raw.class_name}`;
  return parseEntity(VehicleStats, "VehicleStats", context, {
    class_name: raw.class_name,
    channel,
    game_version: requireVersion(raw.version, version, context),
    length_m: requireNumber(raw.sizes?.length, "sizes.length", context),
    beam_m: requireNumber(raw.sizes?.beam, "sizes.beam", context),
    height_m: requireNumber(raw.sizes?.height, "sizes.height", context),
    mass_kg: requireNumber(raw.mass, "mass", context),
    cargo_scu: numberOrNull(raw.cargo_capacity),
    crew_min: requireInt(raw.crew?.min, "crew.min", context),
    crew_max: requireInt(raw.crew?.max, "crew.max", context),
    hull_hp: numberOrNull(raw.health),
    scm_speed: numberOrNull(raw.speed?.scm),
    nav_speed: numberOrNull(raw.speed?.max),
    // The API's fuel fields do not say which of the model's fuel fields they are; the values stay
    // in raw and the Phase 1 normalizer decides from the game files.
    hydrogen_fuel: null,
    quantum_fuel: null,
    hydrogen_capacity: numberOrNull(raw.fuel?.capacity),
    quantum_capacity: numberOrNull(raw.quantum?.quantum_fuel_capacity),
    raw: pruneRaw(raw, VEHICLE_RAW_DROP),
  });
}

export interface PortMapping {
  readonly ports: Port[];
  /** Stock items on component ports, class_name → wiki uuid, in first-seen order. */
  readonly stockItems: Map<string, string>;
  /** Excluded port types → how many subtrees were skipped. */
  readonly excluded: Map<string, number>;
  /** Port types kept as `other` → count. */
  readonly other: Map<string, number>;
  /** Type strings the tables do not cover. The caller halts if any vehicle reports one. */
  readonly unknown: Set<string>;
}

function bump(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

/**
 * Walks the vehicle's port tree. Unknown type strings are collected, not thrown, so one run can
 * report every unknown type across every vehicle; the caller halts on a non-empty set.
 */
export function mapPorts(
  raw: WikiVehicle,
  channel: Channel,
  version: string,
): PortMapping {
  const ports: Port[] = [];
  const stockItems = new Map<string, string>();
  const excluded = new Map<string, number>();
  const other = new Map<string, number>();
  const unknown = new Set<string>();
  const seen = new Set<string>();

  const walk = (list: readonly WikiPort[], parentPath: string | null): void => {
    for (const port of list) {
      // A dummy hardpoint (ADR-022): no name, so no port path, and nothing it could carry. Counted
      // and left out; one that did carry a part would lose it, so that halts instead.
      if (port.name === "") {
        if ((port.equipped_item ?? null) !== null) {
          throw new MapError(
            `port ${raw.class_name}/<unnamed>: an unnamed port carries ${port.equipped_item?.class_name ?? "an item"}, which the Port primary key cannot hold`,
            { class_name: raw.class_name, parent: parentPath },
          );
        }
        bump(excluded, "unnamed");
        continue;
      }
      const classified = classifyType(port.type);
      if (classified.outcome === "unknown") {
        unknown.add(port.type);
        continue;
      }
      if (classified.outcome === "exclude") {
        bump(excluded, port.type);
        continue;
      }
      const portType: PortType =
        classified.outcome === "map" ? classified.portType : "other";
      if (classified.outcome === "other") bump(other, port.type);

      const path =
        parentPath === null ? port.name : `${parentPath}/${port.name}`;
      const context = `port ${raw.class_name}/${path}`;
      if (seen.has(path)) {
        throw new MapError(
          `${context}: the port path appears twice on this vehicle, so the Port primary key cannot hold it`,
          { class_name: raw.class_name, port_path: path },
        );
      }
      seen.add(path);

      const stock = isComponentType(portType)
        ? (port.equipped_item ?? null)
        : null;
      if (stock !== null) {
        requireVersion(
          stock.version,
          version,
          `${context} stock item ${stock.class_name}`,
        );
        if (!stockItems.has(stock.class_name)) {
          stockItems.set(stock.class_name, stock.uuid);
        }
      }

      ports.push(
        parseEntity(Port, "Port", context, {
          class_name: raw.class_name,
          channel,
          game_version: requireVersion(port.version, version, context),
          port_path: path,
          port_name: port.name,
          port_type: portType,
          size_min: requireInt(port.sizes?.min, "sizes.min", context),
          size_max: requireInt(port.sizes?.max, "sizes.max", context),
          parent_port_path: parentPath,
          default_item_class: stock === null ? null : stock.class_name,
          position: text(port.position),
        }),
      );
      walk(port.ports ?? [], path);
    }
  };

  walk(raw.ports ?? [], null);
  return { ports, stockItems, excluded, other, unknown };
}

export function mapItem(raw: WikiItem, slug: string, version: string): Item {
  const context = `item ${raw.class_name}`;
  const classified = classifyType(raw.type);
  if (classified.outcome !== "map" || !isComponentType(classified.portType)) {
    throw new MapError(
      `${context}: type ${JSON.stringify(raw.type)} is not a component kind in the type table`,
      { class_name: raw.class_name, type: raw.type },
    );
  }
  return parseEntity(Item, "Item", context, {
    class_name: raw.class_name,
    slug,
    name: raw.name,
    manufacturer_code: raw.manufacturer.code,
    type: classified.portType,
    subtype: text(raw.sub_type),
    size: requireInt(raw.size, "size", context),
    grade:
      raw.grade === null || raw.grade === undefined ? null : String(raw.grade),
    item_class: text(raw.class)?.toLowerCase() ?? null,
    first_seen_version: requireVersion(raw.version, version, context),
  });
}

export function mapItemStats(
  raw: WikiItem,
  channel: Channel,
  version: string,
): ItemStats {
  const context = `item ${raw.class_name}`;
  return parseEntity(ItemStats, "ItemStats", context, {
    class_name: raw.class_name,
    channel,
    game_version: requireVersion(raw.version, version, context),
    hp: numberOrNull(raw.durability?.health),
    // The API gives min/max pairs for power and EM and two regen delays for shields. Picking one
    // would be an inference, so these stay null and the pairs stay in raw.
    power_draw: null,
    power_output: null,
    heat_generation: null,
    cooling_rate: null,
    em_signature: null,
    ir_signature: numberOrNull(raw.emission?.ir),
    weapon_damage: numberOrNull(raw.vehicle_weapon?.damage?.alpha_total),
    weapon_fire_rate: numberOrNull(raw.vehicle_weapon?.rpm),
    weapon_range: numberOrNull(raw.vehicle_weapon?.range),
    projectile_speed: numberOrNull(raw.ammunition?.speed),
    shield_hp: numberOrNull(raw.shield?.max_health),
    shield_regen: numberOrNull(raw.shield?.regen_rate),
    shield_delay: null,
    qd_speed: numberOrNull(raw.quantum_drive?.standard_jump?.drive_speed),
    qd_range: null,
    qd_fuel_per_jump: null,
    qd_spool_time: numberOrNull(
      raw.quantum_drive?.standard_jump?.spool_up_time,
    ),
    raw: pruneRaw(raw, ITEM_RAW_DROP),
  });
}

// ---------------------------------------------------------------------------
// Catalogue (ADR-016)
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>;
const looseObject = (v: unknown): Loose | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Loose)
    : undefined;
const keep = (v: unknown, keys: readonly string[]): Loose | undefined => {
  const o = looseObject(v);
  if (o === undefined) return undefined;
  const out = Object.fromEntries(
    keys
      .filter((k) => o[k] !== undefined && o[k] !== null)
      .map((k) => [k, o[k]]),
  );
  return Object.keys(out).length === 0 ? undefined : out;
};

/**
 * A catalogue part's record trimmed by rule (ADR-016): its identity and the blocks the loadout
 * editor and the stat mapper read (durability, signatures, gun, ammunition, missile, shield,
 * power plant, cooler and quantum drive figures, and the power network's online deltas), each
 * cut to the fields used. Everything else the API sends (fire modes, spread, tags, interactions,
 * blueprints, prices, translations) is left out to keep the pack small. Stock parts keep their
 * whole record.
 */
export function catalogRecord(raw: Loose): Loose {
  const weapon = looseObject(raw["vehicle_weapon"]);
  const quantum = looseObject(raw["quantum_drive"]);
  const network = looseObject(raw["resource_network"]);
  const states = Array.isArray(network?.["states"])
    ? (network["states"] as unknown[]).map((s) => {
        const state = looseObject(s) ?? {};
        return {
          name: state["name"],
          signature: state["signature"],
          deltas: Array.isArray(state["deltas"])
            ? (state["deltas"] as unknown[]).map((d) =>
                keep(d, [
                  "type",
                  "resource",
                  "rate",
                  "minimum_fraction",
                  "generated_resource",
                  "generated_rate",
                ]),
              )
            : [],
        };
      })
    : undefined;
  const record: Loose = {
    ...keep(raw, [
      "uuid",
      "name",
      "class_name",
      "type",
      "sub_type",
      "size",
      "grade",
      "class",
      "version",
      "mass",
      "manufacturer",
      "emission",
    ]),
    durability: keep(raw["durability"], ["health"]),
    vehicle_weapon:
      weapon === undefined
        ? undefined
        : {
            ...keep(weapon, [
              "class",
              "type",
              "capacity",
              "range",
              "damage_per_shot",
              "regeneration",
              "rpm",
            ]),
            damage: keep(weapon["damage"], [
              "alpha_total",
              "sustained_60s",
              "burst",
              "dps",
              "alpha",
            ]),
          },
    ammunition: keep(raw["ammunition"], [
      "speed",
      "range",
      "lifetime",
      "capacity",
    ]),
    missile: keep(raw["missile"], [
      "signal_type",
      "lock_time",
      "lock_range_max",
      "lock_range_min",
      "lock_angle",
      "speed",
      "damage_total",
      "damage_map",
      "explosion_radius_min",
      "explosion_radius_max",
    ]),
    shield: keep(raw["shield"], [
      "max_health",
      "regen_rate",
      "regen_time",
      "regen_delay",
      "absorption",
      "resistance",
    ]),
    power_plant: keep(raw["power_plant"], ["power_segment_generation"]),
    cooler: keep(raw["cooler"], ["coolant_segment_generation"]),
    quantum_drive:
      quantum === undefined
        ? undefined
        : {
            ...keep(quantum, ["quantum_fuel_requirement", "jump_range"]),
            standard_jump: keep(quantum["standard_jump"], [
              "drive_speed",
              "spool_up_time",
              "cooldown_time",
              "stage_one_accel_rate",
              "stage_two_accel_rate",
            ]),
          },
    resource_network: states === undefined ? undefined : { states },
  };
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  );
}

/** True when a part of this wiki type and size fits a port on one of the pack's ships. */
export function fitsAPort(
  type: string,
  size: number | null | undefined,
  ports: readonly Pick<Port, "port_type" | "size_min" | "size_max">[],
): boolean {
  const portType = TYPE_MAP[type];
  if (portType === undefined || typeof size !== "number") return false;
  return ports.some(
    (p) => p.port_type === portType && size >= p.size_min && size <= p.size_max,
  );
}
