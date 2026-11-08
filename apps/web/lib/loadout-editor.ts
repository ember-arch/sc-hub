import type { Item, ItemStats, PortType } from "schema";
import type { ComponentView, PortNode } from "./data";

/**
 * The loadout editor's model (ADR-016): every port on the ship that takes a swappable part (gun,
 * missile or torpedo, shield, power plant, cooler, quantum drive), what it carries stock, and the
 * parts in the pack that fit it, each with the figures a captain compares them by. Fit is the
 * game's own: the part's type matches the port's and its size is inside the port's range. Every
 * figure is read from the part's record; none is computed beyond sums. Pure; unit-tested over the
 * fixture pack.
 */

export type SlotGroup =
  "guns" | "missiles" | "shields" | "power" | "cooling" | "quantum";

export const SLOT_GROUPS: readonly {
  readonly id: SlotGroup;
  readonly title: string;
}[] = [
  { id: "guns", title: "Guns" },
  { id: "missiles", title: "Missiles and torpedoes" },
  { id: "shields", title: "Shields" },
  { id: "power", title: "Power plants" },
  { id: "cooling", title: "Coolers" },
  { id: "quantum", title: "Quantum drive" },
];

const GROUP_OF: Partial<Record<PortType, SlotGroup>> = {
  weapon: "guns",
  missile: "missiles",
  shield: "shields",
  power_plant: "power",
  cooler: "cooling",
  quantum_drive: "quantum",
};

const TYPE_OF: Record<SlotGroup, Item["type"]> = {
  guns: "weapon",
  missiles: "missile",
  shields: "shield",
  power: "power_plant",
  cooling: "cooler",
  quantum: "quantum_drive",
};

export interface EditorSlot {
  /** The port's path: stable within the ship. */
  readonly key: string;
  readonly group: SlotGroup;
  /** Where it is, in words from the game's port names ("Left wing", "Nose"). */
  readonly location: string;
  /** What holds it: the gimbal, turret or rack it sits in, when it sits in one. */
  readonly mount: string | null;
  /** The holding port's path; slots that share one are edited together on request. */
  readonly mountKey: string | null;
  readonly sizeMin: number;
  readonly sizeMax: number;
  /** The stock part's class name, null for an empty port. */
  readonly stock: string | null;
}

export type DamageType = "Energy" | "Physical" | "Distortion" | "Mixed";

export interface OptionStats {
  /** Guns: damage per second while firing, damage per shot, rounds per minute, metres, m/s. */
  readonly dps: number | null;
  readonly alpha: number | null;
  readonly rpm: number | null;
  readonly range: number | null;
  readonly speed: number | null;
  readonly damageType: DamageType | null;
  /** Ballistic guns: rounds carried; null for weapons that draw power instead. */
  readonly ammo: number | null;
  /** Missiles and torpedoes: damage on detonation, what they track, lock range in metres. */
  readonly damage: number | null;
  readonly tracking: string | null;
  readonly lockRange: number | null;
  /** Shields: health and regeneration per second. */
  readonly shieldHp: number | null;
  readonly shieldRegen: number | null;
  /** Power plants: power segments generated. Coolers: coolant segments generated. */
  readonly powerOut: number | null;
  readonly coolantOut: number | null;
  /** Quantum drives: drive speed in m/s, spool time in seconds, fuel per gigametre. */
  readonly qdSpeed: number | null;
  readonly qdSpool: number | null;
  readonly qdFuel: number | null;
  /** Power segments the part draws when on. */
  readonly powerDraw: number | null;
}

export interface EditorOption {
  /** The part's class name. */
  readonly id: string;
  readonly slug: string;
  readonly group: SlotGroup;
  readonly name: string;
  readonly maker: string;
  readonly size: number;
  readonly grade: string | null;
  /** What it is, in the game's words: "Laser repeater", "Torpedo", "Military". */
  readonly kind: string | null;
  readonly stats: OptionStats;
}

export interface EditorModel {
  readonly slots: readonly EditorSlot[];
  /** Every part that fits at least one slot, by class name. */
  readonly options: Readonly<Record<string, EditorOption>>;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const at = (v: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((o, k) => obj(o)?.[k], v);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** The game's power figure for a part: what it draws, or for a power plant what it generates. */
function powerDeltas(raw: Obj): {
  draw: number | null;
  out: number | null;
  coolant: number | null;
} {
  const states = at(raw, "resource_network", "states");
  const online = Array.isArray(states)
    ? (states.map(obj).find((s) => s?.["name"] === "Online") ?? null)
    : null;
  const deltas = Array.isArray(online?.["deltas"])
    ? (online["deltas"] as unknown[])
    : [];
  let draw: number | null = null;
  let out: number | null = null;
  let coolant: number | null = null;
  for (const d of deltas.map(obj)) {
    if (d === null) continue;
    const rate = num(d["rate"]);
    if (d["resource"] === "Power" && d["type"] === "Generation") out = rate;
    else if (
      d["resource"] === "Power" &&
      (d["type"] === "Consumption" || d["type"] === "Conversion")
    )
      draw = (draw ?? 0) + (rate ?? 0);
    if (d["generated_resource"] === "Coolant")
      coolant = num(d["generated_rate"]);
  }
  return { draw, out, coolant };
}

function damageType(map: unknown): DamageType | null {
  const m = obj(map);
  if (m === null) return null;
  const parts = (
    [
      ["Physical", num(m["physical"]) ?? 0],
      ["Energy", num(m["energy"]) ?? 0],
      ["Distortion", num(m["distortion"]) ?? 0],
    ] as const
  ).filter(([, v]) => v > 0);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0]![0] : "Mixed";
}

const TRACKING: Readonly<Record<string, string>> = {
  CrossSection: "Cross-section",
  Electromagnetic: "EM",
  Infrared: "IR",
};

/** Sentence case of the game's own words: "Laser Repeater" → "Laser repeater". */
function sentenceCase(s: string | null): string | null {
  if (s === null) return null;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function optionStats(stats: ItemStats | null): OptionStats {
  const raw: Obj = stats?.raw ?? {};
  const weapon = at(raw, "vehicle_weapon");
  const missile = at(raw, "missile");
  const power = powerDeltas(raw);
  const capacity = num(at(weapon, "capacity"));
  const fuel = num(at(raw, "quantum_drive", "quantum_fuel_requirement"));
  return {
    dps: num(at(weapon, "damage", "burst")),
    alpha:
      num(at(weapon, "damage", "alpha_total")) ?? stats?.weapon_damage ?? null,
    rpm: num(at(weapon, "rpm")) ?? stats?.weapon_fire_rate ?? null,
    range: num(at(weapon, "range")) ?? stats?.weapon_range ?? null,
    speed: stats?.projectile_speed ?? num(at(missile, "speed")),
    damageType:
      damageType(at(weapon, "damage", "dps")) ??
      damageType(at(missile, "damage_map")),
    ammo: capacity !== null && capacity > 0 ? capacity : null,
    damage: num(at(missile, "damage_total")),
    tracking: (() => {
      const t = text(at(missile, "signal_type"));
      return t === null ? null : (TRACKING[t] ?? t);
    })(),
    lockRange: num(at(missile, "lock_range_max")),
    shieldHp: stats?.shield_hp ?? null,
    shieldRegen: stats?.shield_regen ?? null,
    powerOut:
      num(at(raw, "power_plant", "power_segment_generation")) ?? power.out,
    coolantOut:
      num(at(raw, "cooler", "coolant_segment_generation")) ?? power.coolant,
    qdSpeed: stats?.qd_speed ?? null,
    qdSpool: stats?.qd_spool_time ?? null,
    // The game states fuel per megametre of travel; per gigametre reads better.
    qdFuel: fuel === null ? null : fuel * 1000,
    powerDraw: power.draw,
  };
}

/** What a part is, in the game's words: "Laser repeater", "Torpedo", a component's class. */
export function partKind(item: Item, stats: ItemStats | null): string | null {
  const raw: Obj = stats?.raw ?? {};
  if (item.type === "weapon")
    return sentenceCase(text(at(raw, "vehicle_weapon", "type")));
  if (item.type === "missile")
    return item.subtype === "Torpedo" ? "Torpedo" : "Missile";
  return sentenceCase(item.item_class);
}

/** Port-name words that say where a port is; the rest ("hardpoint", "gun", numbers) are dropped. */
const PLACE_WORDS = new Set([
  "left",
  "right",
  "nose",
  "chin",
  "wing",
  "wingtip",
  "top",
  "bottom",
  "front",
  "rear",
  "back",
  "inner",
  "outer",
  "upper",
  "lower",
  "center",
  "centre",
  "mid",
  "middle",
  "side",
  "tail",
  "fore",
  "aft",
  "belly",
  "dorsal",
  "ventral",
  "main",
  "remote",
  "manned",
  "turret",
  "pilot",
  "copilot",
  "body",
  "fuselage",
  "cockpit",
]);

/** "hardpoint_gun_left_wing" → "Left wing"; null when the name says nothing about place. */
export function placeOf(portName: string): string | null {
  const words = portName
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter((w) => PLACE_WORDS.has(w));
  if (words.length === 0) return null;
  const phrase = words.join(" ").replace("centre", "center");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Builds the editor's slots and options from the ship's port tree and the pack's components. */
export function editorModel(
  roots: readonly PortNode[],
  components: readonly ComponentView[],
): EditorModel {
  const slots: EditorSlot[] = [];
  const counters = new Map<SlotGroup, number>();
  const walk = (
    nodes: readonly PortNode[],
    parent: PortNode | null,
    parentPlace: string | null,
  ) => {
    for (const node of nodes) {
      const place = placeOf(node.port.port_name) ?? parentPlace;
      const group = GROUP_OF[node.port.port_type];
      if (group !== undefined) {
        const n = (counters.get(group) ?? 0) + 1;
        counters.set(group, n);
        slots.push({
          key: node.port.port_path,
          group,
          location: place ?? `No. ${n}`,
          mount: parent?.item?.name ?? null,
          mountKey: parent?.port.port_path ?? null,
          sizeMin: node.port.size_min,
          sizeMax: node.port.size_max,
          stock: node.item?.class_name ?? null,
        });
      }
      walk(node.children, node, place);
    }
  };
  walk(roots, null, null);

  const options: Record<string, EditorOption> = {};
  for (const c of components) {
    const group = (Object.keys(TYPE_OF) as SlotGroup[]).find(
      (g) => TYPE_OF[g] === c.item.type,
    );
    if (group === undefined) continue;
    const fits = slots.some(
      (s) =>
        s.group === group &&
        c.item.size >= s.sizeMin &&
        c.item.size <= s.sizeMax,
    );
    const stock = slots.some((s) => s.stock === c.item.class_name);
    if (!fits && !stock) continue;
    options[c.item.class_name] = {
      id: c.item.class_name,
      slug: c.item.slug,
      group,
      name: c.item.name,
      maker: c.manufacturer?.name ?? c.item.manufacturer_code,
      size: c.item.size,
      grade: c.item.grade,
      kind: partKind(c.item, c.stats),
      stats: optionStats(c.stats),
    };
  }
  // A slot whose part the pack does not hold, and with nothing that fits, is not editable.
  return {
    slots: slots.filter(
      (s) =>
        (s.stock !== null && options[s.stock] !== undefined) ||
        Object.values(options).some(
          (o) =>
            o.group === s.group && o.size >= s.sizeMin && o.size <= s.sizeMax,
        ),
    ),
    options,
  };
}

/** The parts that fit a slot, best first by the group's headline figure. */
export function optionsFor(
  slot: EditorSlot,
  options: Readonly<Record<string, EditorOption>>,
): EditorOption[] {
  return Object.values(options)
    .filter(
      (o) =>
        o.group === slot.group &&
        o.size >= slot.sizeMin &&
        o.size <= slot.sizeMax,
    )
    .sort(
      (a, b) =>
        (headline(b) ?? -1) - (headline(a) ?? -1) ||
        a.name.localeCompare(b.name, "en"),
    );
}

/** The one figure a part is ranked by in its group. */
export function headline(o: EditorOption): number | null {
  switch (o.group) {
    case "guns":
      return o.stats.dps;
    case "missiles":
      return o.stats.damage;
    case "shields":
      return o.stats.shieldHp;
    case "power":
      return o.stats.powerOut;
    case "cooling":
      return o.stats.coolantOut;
    case "quantum":
      return o.stats.qdSpeed;
  }
}

/** What a loadout adds up to: the sums a captain compares builds by. */
export interface LoadoutTotals {
  readonly gunDps: number;
  readonly gunAlpha: number;
  /** Gun damage per second by type. */
  readonly dpsByType: Readonly<
    Record<"Energy" | "Physical" | "Distortion", number>
  >;
  readonly missileDamage: number;
  readonly missiles: number;
  readonly shieldHp: number;
  readonly shieldRegen: number;
  readonly powerOut: number;
  readonly powerDraw: number;
  readonly coolantOut: number;
  readonly qdSpeed: number | null;
  readonly qdSpool: number | null;
}

/** Sums a loadout: `fitted` maps slot keys to class names (null for an emptied slot). */
export function totals(
  slots: readonly EditorSlot[],
  fitted: Readonly<Record<string, string | null>>,
  options: Readonly<Record<string, EditorOption>>,
): LoadoutTotals {
  let gunDps = 0;
  let gunAlpha = 0;
  const dpsByType = { Energy: 0, Physical: 0, Distortion: 0 };
  let missileDamage = 0;
  let missiles = 0;
  let shieldHp = 0;
  let shieldRegen = 0;
  let powerOut = 0;
  let powerDraw = 0;
  let coolantOut = 0;
  let qdSpeed: number | null = null;
  let qdSpool: number | null = null;
  for (const slot of slots) {
    const id = slot.key in fitted ? fitted[slot.key] : slot.stock;
    const o = id === null || id === undefined ? undefined : options[id];
    if (o === undefined) continue;
    const s = o.stats;
    powerDraw += s.powerDraw ?? 0;
    switch (slot.group) {
      case "guns":
        gunDps += s.dps ?? 0;
        gunAlpha += s.alpha ?? 0;
        if (s.damageType !== null && s.damageType !== "Mixed")
          dpsByType[s.damageType] += s.dps ?? 0;
        break;
      case "missiles":
        missileDamage += s.damage ?? 0;
        missiles += 1;
        break;
      case "shields":
        shieldHp += s.shieldHp ?? 0;
        shieldRegen += s.shieldRegen ?? 0;
        break;
      case "power":
        powerOut += s.powerOut ?? 0;
        break;
      case "cooling":
        coolantOut += s.coolantOut ?? 0;
        break;
      case "quantum":
        qdSpeed = s.qdSpeed;
        qdSpool = s.qdSpool;
        break;
    }
  }
  return {
    gunDps,
    gunAlpha,
    dpsByType,
    missileDamage,
    missiles,
    shieldHp,
    shieldRegen,
    powerOut,
    powerDraw,
    coolantOut,
    qdSpeed,
    qdSpool,
  };
}
