import type {
  PatchBlueprint,
  PatchFigures,
  PatchIngredient,
  PatchPart,
  PatchShip,
  PatchValue,
} from "schema";
import { MapError } from "../bootstrap-fixtures/errors.js";

/**
 * Turns the Star Citizen Wiki API's records for one build into the figures a comparison reads
 * (ADR-049). Pure functions over the API's JSON, so the unit tests run on the cut responses in
 * `fixtures/patches/samples/` and no test reaches the network.
 *
 * Figures are taken as the source states them, flattened to dotted paths. Nothing is computed,
 * rounded or renamed here; labels belong to the page (`apps/web/lib/patch-labels.ts`).
 */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** The part types a comparison follows: everything fitted to a ship that has figures of its own. */
export const PART_TYPES = [
  "WeaponGun",
  "Missile",
  "Bomb",
  "MissileLauncher",
  "BombLauncher",
  "Shield",
  "PowerPlant",
  "Cooler",
  "QuantumDrive",
  "JumpDrive",
  "Radar",
  "WeaponDefensive",
  "WeaponMining",
  "MiningModifier",
  "TractorBeam",
  "TowingBeam",
  "SalvageHead",
  "SalvageModifier",
  "EMP",
  "QuantumInterdictionGenerator",
] as const;

/** Ports whose fitted part is followed in the loadout: the parts above and the mounts that carry them. */
const LOADOUT_TYPES = new Set<string>([
  ...PART_TYPES,
  "Turret",
  "TurretBase",
  "UtilityTurret",
  "GroundVehicleMissileLauncher",
]);

/** The sections of a ship record that hold its figures. Everything else is identity, text or lists. */
export const SHIP_SECTIONS = [
  "sizes",
  "mass_hull",
  "mass_loadout",
  "mass_total",
  "cargo_capacity",
  "ore_capacity",
  "vehicle_inventory",
  "crew",
  "seating",
  "health",
  "shield",
  "speed",
  "afterburner",
  "fuel",
  "quantum",
  "agility",
  "armor",
  "cross_section",
  "emission",
  "signature",
  "insurance",
  "cooling",
  "power",
  "penetration_multiplier",
  "weapon_storage",
  "size_class",
  "career",
  "role",
] as const;

/** Sections of a part record that are not figures: words, prices, pictures, lists and duplicates. */
const PART_SKIP = new Set([
  "description",
  "description_data",
  "manufacturer",
  "manufacturer_description",
  "dimension",
  "uex_prices",
  "shops",
  "variants",
  "blueprint",
  "images",
  "tags",
  "required_tags",
  "entity_tags",
  "entity_tag_map",
  "interactions",
  "event_source",
  "ports",
  // The same block sits inside vehicle_weapon for guns.
  "ammunition",
  "resource_network",
  // Identity, kept as fields of their own or not at all.
  "uuid",
  "slug",
  "name",
  "class_name",
  "classification",
  "classification_label",
  "type",
  "type_label",
  "sub_type",
  "sub_type_label",
  "size",
  "grade",
  "is_base_variant",
]);

/** Keys that are never figures wherever they appear. */
function skippedKey(key: string, siblings: Obj): boolean {
  if (
    key === "uuid" ||
    key === "link" ||
    key === "web_url" ||
    key === "updated_at" ||
    key === "version" ||
    key === "unit" ||
    key.endsWith("_uuid") ||
    key.endsWith("_label") ||
    key.endsWith("_formatted") ||
    key.endsWith("_url") ||
    // The armour's multipliers carry a "_change" twin of each value: the value less one.
    key.endsWith("_change")
  ) {
    return true;
  }
  // The API states some limits twice, as min/max and minimum/maximum.
  if (key === "maximum" && "max" in siblings) return true;
  if (key === "minimum" && "min" in siblings) return true;
  return false;
}

/** A short string is a figure ("Infrared", "Bubble"); a long one is prose. */
const MAX_TEXT = 80;

/** Every number, flag and short string under `value`, by dotted path. Lists are left out. */
export function flatten(
  value: unknown,
  prefix: string,
  out: Record<string, PatchValue> = {},
): Record<string, PatchValue> {
  if (typeof value === "number") {
    if (Number.isFinite(value) && prefix !== "") out[prefix] = value;
    return out;
  }
  if (typeof value === "boolean") {
    if (prefix !== "") out[prefix] = value;
    return out;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (t !== "" && t.length <= MAX_TEXT && prefix !== "") out[prefix] = t;
    return out;
  }
  const o = obj(value);
  if (o === null) return out;
  for (const [key, child] of Object.entries(o)) {
    if (skippedKey(key, o)) continue;
    flatten(child, prefix === "" ? key : `${prefix}.${key}`, out);
  }
  return out;
}

/** Sorted by path, so a file's diff in review shows only what moved. */
function sorted(figures: Record<string, PatchValue>): PatchFigures {
  return Object.fromEntries(
    Object.entries(figures).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/**
 * The power network, by state: what each state draws or makes of each resource, and its signature.
 * The API states it as a list; the list is keyed here by the names it carries.
 */
function resourceNetwork(raw: unknown): Record<string, PatchValue> {
  const out: Record<string, PatchValue> = {};
  const network = obj(raw);
  if (network === null) return out;
  const scalars: Obj = { ...network };
  delete scalars["states"];
  flatten(scalars, "resource_network", out);
  const states = Array.isArray(network["states"]) ? network["states"] : [];
  for (const state of states.map(obj)) {
    const name = text(state?.["name"]);
    if (state === null || name === null) continue;
    const base = `resource_network.states.${name}`;
    flatten(state["signature"], `${base}.signature`, out);
    const deltas = Array.isArray(state["deltas"]) ? state["deltas"] : [];
    for (const d of deltas.map(obj)) {
      const resource = text(d?.["resource"]);
      const type = text(d?.["type"]);
      if (d === null || resource === null || type === null) continue;
      const key = `${base}.${resource}.${type}`;
      if (typeof d["rate"] === "number" && Number.isFinite(d["rate"]))
        out[key] = d["rate"];
      const generated = text(d["generated_resource"]);
      if (generated !== null && typeof d["generated_rate"] === "number")
        out[`${key}.${generated}`] = d["generated_rate"];
    }
  }
  return out;
}

/** The wiki keeps unnamed placeholders the game files declare; they are not entries. */
export const isPlaceholder = (name: string): boolean =>
  /^<=.*=>$/.test(name.trim());

/** A ship's figures from its record (`/api/vehicles/<uuid>?include=hardpoints&version=…`). */
export function shipFigures(raw: Obj): PatchFigures {
  const out: Record<string, PatchValue> = {};
  for (const section of SHIP_SECTIONS) flatten(raw[section], section, out);
  return sorted(dropped(out, SHIP_DROP));
}

/** The part fitted at each followed port, by port path (parent names joined by `/`). */
export function shipLoadout(raw: Obj): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (ports: unknown, path: string): void => {
    if (!Array.isArray(ports)) return;
    for (const port of ports.map(obj)) {
      const name = text(port?.["name"]);
      if (port === null || name === null) continue;
      const here = path === "" ? name : `${path}/${name}`;
      const item = obj(port["equipped_item"]);
      const cls = text(item?.["class_name"]);
      const type = text(item?.["type"]);
      if (cls !== null && type !== null && LOADOUT_TYPES.has(type)) {
        out[here] = cls;
      }
      walk(port["ports"], here);
    }
  };
  walk(raw["ports"], "");
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

export function mapShip(raw: Obj): PatchShip {
  const name = text(raw["name"]);
  if (name === null) {
    throw new MapError("a ship record has no name", {
      class_name: raw["class_name"],
    });
  }
  return {
    name,
    game_name: text(raw["game_name"]),
    manufacturer: text(obj(raw["manufacturer"])?.["code"]),
    figures: shipFigures(raw),
    loadout: shipLoadout(raw),
  };
}

/** A part's figures from its record in `/api/items?filter[type]=…&version=…`. */
export function partFigures(raw: Obj): PatchFigures {
  const out: Record<string, PatchValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (PART_SKIP.has(key) || skippedKey(key, raw)) continue;
    flatten(value, key, out);
  }
  Object.assign(out, resourceNetwork(raw["resource_network"]));
  return sorted(dropped(out, PART_DROP));
}

/**
 * Ship figures the record states twice, or works out from the parts fitted to the ship (which are
 * compared as parts): the armour's flat copies of its multipliers and the plural copies of each
 * block, the shield's resistances (the fitted shield's), and signature, power and cooling totals
 * by part type.
 */
const SHIP_DROP: readonly RegExp[] = [
  /^armor\.(damage|signal)_[a-z_]+$/,
  /^armor\.[a-z_]+_multipliers\./,
  /^signature\.em_(segment_)?groups_/,
  /_grouped\./,
  /^shield\.(resistance|absorption)\./,
];

/** Part figures stated twice: power and coolant use (the states say it) and the magazine in µSCU. */
const PART_DROP: readonly RegExp[] = [
  /^resource_network\.usage\./,
  /\.micro_scu$/,
];

function dropped(
  figures: Record<string, PatchValue>,
  rules: readonly RegExp[],
): Record<string, PatchValue> {
  return Object.fromEntries(
    Object.entries(figures).filter(([k]) => !rules.some((r) => r.test(k))),
  );
}

export function mapPart(raw: Obj): PatchPart {
  const name = text(raw["name"]);
  const type = text(raw["type"]);
  if (name === null || type === null) {
    throw new MapError("a part record has no name or type", {
      class_name: raw["class_name"],
    });
  }
  const size = raw["size"];
  const subType = text(raw["sub_type"]);
  return {
    name,
    type,
    sub_type: subType === null || subType === "UNDEFINED" ? null : subType,
    size: typeof size === "number" && Number.isInteger(size) ? size : null,
    grade:
      typeof raw["grade"] === "number"
        ? String(raw["grade"])
        : text(raw["grade"]),
    manufacturer: text(obj(raw["manufacturer"])?.["code"]),
    figures: partFigures(raw),
  };
}

/** A blueprint from `/api/blueprints?version=…`: what it makes, how long it takes, what it takes. */
export function mapBlueprint(raw: Obj): PatchBlueprint {
  const output = text(raw["output_name"]);
  if (output === null) {
    throw new MapError("a blueprint names no output", { key: raw["key"] });
  }
  const figures: Record<string, PatchValue> = {};
  for (const key of [
    "craft_time_seconds",
    "is_available_by_default",
    "unlocking_missions_count",
    "ingredient_count",
  ]) {
    flatten(raw[key], key, figures);
  }
  const ingredients: Record<string, PatchIngredient> = {};
  const list = Array.isArray(raw["ingredients"]) ? raw["ingredients"] : [];
  for (const ing of list.map(obj)) {
    const name = text(ing?.["name"]);
    if (ing === null || name === null) continue;
    const scu = ing["quantity_scu"];
    const count = ing["quantity"];
    const entry: PatchIngredient | null =
      typeof scu === "number" && Number.isFinite(scu)
        ? { amount: scu, unit: "SCU" }
        : typeof count === "number" && Number.isFinite(count)
          ? { amount: count, unit: "each" }
          : null;
    if (entry === null) continue;
    const prior = ingredients[name];
    // One ingredient listed twice is one requirement of the summed amount.
    ingredients[name] =
      prior !== undefined && prior.unit === entry.unit
        ? { amount: prior.amount + entry.amount, unit: entry.unit }
        : entry;
  }
  return {
    output_name: output,
    output_class: text(raw["output_class"]),
    figures: sorted(figures),
    ingredients: Object.fromEntries(
      Object.entries(ingredients).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    ),
  };
}

/**
 * The file as written: the header pretty, then one record per line, so a review of a new build's
 * file reads like a list and a refetch shows only the lines that moved.
 */
export function renderSnapshot(snapshot: {
  readonly [key: string]: unknown;
}): string {
  const lines: string[] = ["{"];
  const entries = Object.entries(snapshot);
  entries.forEach(([key, value], i) => {
    const comma = i < entries.length - 1 ? "," : "";
    if (Array.isArray(value) && key === "dictionary") {
      lines.push(`  ${JSON.stringify(key)}: [`);
      value.forEach((w, j) => {
        lines.push(
          `    ${JSON.stringify(w)}${j < value.length - 1 ? "," : ""}`,
        );
      });
      lines.push(`  ]${comma}`);
      return;
    }
    const records = obj(value);
    if (
      records !== null &&
      (key === "ships" || key === "parts" || key === "blueprints")
    ) {
      const rows = Object.entries(records);
      if (rows.length === 0) {
        lines.push(`  ${JSON.stringify(key)}: {}${comma}`);
        return;
      }
      lines.push(`  ${JSON.stringify(key)}: {`);
      rows.forEach(([id, row], j) => {
        lines.push(
          `    ${JSON.stringify(id)}: ${JSON.stringify(row)}${j < rows.length - 1 ? "," : ""}`,
        );
      });
      lines.push(`  }${comma}`);
      return;
    }
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`);
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
