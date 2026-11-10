/**
 * Armour, shields and the armour's damage multiplier (ADR-026). The game gives every ship an
 * armour record with, for each kind of damage, a damage multiplier (0.6 on energy means energy
 * damage is multiplied by 0.6), and its stock shields: health, regeneration and the face type.
 * Both are in the vehicle's record as the Wiki API serves it, kept in `VehicleStats.raw` like
 * the insurance terms and the loadout editor's figures (ADR-013, ADR-016). A gun's record
 * carries its damage per second by kind. Nothing here is computed beyond one product per kind
 * and their sum: the damage fired, times the armour's multiplier for that kind. The records hold
 * more (the armour's resistance multipliers, deflection and penetration resistance, the ship's
 * penetration multiplier, the shields' absorption and resistance ranges) with no published rule
 * for how the game applies them, so none of it is applied and nothing is said about the hull's
 * fate beyond the multiplier (CLAUDE.md section 2).
 */

export const DAMAGE_KINDS = [
  "physical",
  "energy",
  "distortion",
  "thermal",
  "biochemical",
  "stun",
] as const;
export type DamageKind = (typeof DAMAGE_KINDS)[number];

export const DAMAGE_KIND_LABEL: Readonly<Record<DamageKind, string>> = {
  physical: "Physical",
  energy: "Energy",
  distortion: "Distortion",
  thermal: "Thermal",
  biochemical: "Biochemical",
  stun: "Stun",
};

export interface Armour {
  /** The armour's own health, when the record has one. */
  readonly hp: number | null;
  /** The armour's damage multiplier per kind, as the record gives it: 1 leaves a kind as it is. */
  readonly multiplier: Readonly<Record<DamageKind, number>>;
}

export interface Shields {
  readonly hp: number;
  /** Health regenerated per second, when the record has it. */
  readonly regen: number | null;
  /** "Bubble" or "Quadrant", as the record says. */
  readonly faceType: string | null;
}

/** Damage per second by kind; a kind the weapon does not deal is absent. */
export type DpsByKind = Partial<Readonly<Record<DamageKind, number>>>;

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The vehicle record's armour: every kind's multiplier present, or nothing. */
export function armourOf(raw: unknown): Armour | null {
  const armor = obj(obj(raw)?.["armor"]);
  const multipliers = obj(armor?.["damage_multiplier"]);
  if (armor === null || multipliers === null) return null;
  const multiplier: Partial<Record<DamageKind, number>> = {};
  for (const kind of DAMAGE_KINDS) {
    const m = num(multipliers[kind]);
    if (m === null || m < 0) return null;
    multiplier[kind] = m;
  }
  return {
    hp: num(armor["health"]),
    multiplier: multiplier as Record<DamageKind, number>,
  };
}

/** The vehicle record's stock shields, or nothing where the ship has none on record. */
export function shieldsOf(raw: unknown): Shields | null {
  const r = obj(raw);
  if (r === null) return null;
  const shield = obj(r["shield"]);
  const hp = num(shield?.["hp"]) ?? num(r["shield_hp"]);
  if (hp === null || hp <= 0) return null;
  const faceType = shield?.["face_type"];
  return {
    hp,
    regen: num(shield?.["regeneration"]),
    faceType: typeof faceType === "string" && faceType !== "" ? faceType : null,
  };
}

/** A weapon record's damage per second by kind; null for a part that deals none. */
export function dpsByKindOf(raw: unknown): DpsByKind | null {
  const dps = obj(obj(obj(obj(raw)?.["vehicle_weapon"])?.["damage"])?.["dps"]);
  if (dps === null) return null;
  const out: Partial<Record<DamageKind, number>> = {};
  for (const kind of DAMAGE_KINDS) {
    const v = num(dps[kind]);
    if (v !== null && v > 0) out[kind] = v;
  }
  return Object.keys(out).length === 0 ? null : out;
}

export interface AfterArmour {
  /** Damage per second fired, and the same after the armour's multiplier, all kinds together. */
  readonly fired: number;
  readonly after: number;
  readonly kinds: readonly {
    readonly kind: DamageKind;
    readonly fired: number;
    readonly after: number;
    /** The armour's multiplier for this kind, as the record gives it. */
    readonly multiplier: number;
  }[];
}

/** Each kind fired, times the armour's multiplier for it; and the sums. */
export function afterArmour(dps: DpsByKind, armour: Armour): AfterArmour {
  const kinds = DAMAGE_KINDS.flatMap((kind) => {
    const fired = dps[kind] ?? 0;
    if (fired <= 0) return [];
    const multiplier = armour.multiplier[kind];
    return [{ kind, fired, after: fired * multiplier, multiplier }];
  });
  return {
    fired: kinds.reduce((a, k) => a + k.fired, 0),
    after: kinds.reduce((a, k) => a + k.after, 0),
    kinds,
  };
}

/** "×0.75" for a multiplier, as the records give it, two decimals at most. */
export function times(multiplier: number): string {
  return `×${multiplier.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * "multiplies physical damage by 0.75 and energy by 0.6; distortion, thermal, biochemical and
 * stun by 1": the armour in words, the record's own figures and nothing more.
 */
export function armourInWords(armour: Armour): string {
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const kind of DAMAGE_KINDS) {
    const m = armour.multiplier[kind];
    const label = DAMAGE_KIND_LABEL[kind].toLowerCase();
    if (m === 1) unchanged.push(label);
    else
      changed.push(
        `${label} by ${m.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      );
  }
  if (changed.length === 0) return "multiplies every kind of damage by 1";
  const first = changed[0]!.replace(/^(\w+) by/, "$1 damage by");
  const changedText = joinWords([first, ...changed.slice(1)]);
  return unchanged.length === 0
    ? `multiplies ${changedText}`
    : `multiplies ${changedText}; ${joinWords(unchanged)} by 1`;
}

/** "Physical ×0.75, energy ×0.6": the fact-row form; kinds multiplied by 1 are left unsaid. */
export function armourBrief(armour: Armour): string {
  const parts = DAMAGE_KINDS.flatMap((kind) => {
    const m = armour.multiplier[kind];
    return m === 1 ? [] : [`${DAMAGE_KIND_LABEL[kind]} ${times(m)}`];
  });
  return parts.length === 0
    ? "Every kind of damage ×1"
    : parts.map((p, i) => (i === 0 ? p : p.toLowerCase())).join(", ");
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
