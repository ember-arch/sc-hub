/**
 * Armour, shields and what gets through (ADR-026). The game gives every ship an armour record:
 * for each kind of damage, the share the hull takes once the armour has done its work (0.6 means
 * six tenths of energy damage gets through), and the ship's stock shields: health, regeneration
 * and the face type. Both are in the vehicle's record as the Wiki API serves it, kept in
 * `VehicleStats.raw` like the insurance terms and the loadout editor's figures (ADR-013, ADR-016).
 * A weapon's record carries its damage per second by kind. Nothing here is computed beyond one
 * product per kind and their sum: what reaches the hull is what was fired times the share the
 * armour lets through. Penetration, deflection and the shields' resistance ranges are in the
 * records too; their rules are not published, so they are not applied (CLAUDE.md section 2).
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
  /** The share of each kind of damage the hull takes through the armour: 1 is all of it. */
  readonly taken: Readonly<Record<DamageKind, number>>;
}

export interface Shields {
  readonly hp: number;
  /** Health regenerated per second, when the record has it. */
  readonly regen: number | null;
  /** "Bubble" or "Face", as the record says. */
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
  const taken: Partial<Record<DamageKind, number>> = {};
  for (const kind of DAMAGE_KINDS) {
    const share = num(multipliers[kind]);
    if (share === null || share < 0) return null;
    taken[kind] = share;
  }
  return {
    hp: num(armor["health"]),
    taken: taken as Record<DamageKind, number>,
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

export interface ThroughArmour {
  /** Damage per second fired, and what reaches the hull, all kinds together. */
  readonly fired: number;
  readonly reaching: number;
  readonly kinds: readonly {
    readonly kind: DamageKind;
    readonly fired: number;
    readonly reaching: number;
    /** The armour's share for this kind, as the record gives it. */
    readonly taken: number;
  }[];
}

/** What reaches the hull: each kind fired, times the share the armour lets through. */
export function throughArmour(dps: DpsByKind, armour: Armour): ThroughArmour {
  const kinds = DAMAGE_KINDS.flatMap((kind) => {
    const fired = dps[kind] ?? 0;
    if (fired <= 0) return [];
    const taken = armour.taken[kind];
    return [{ kind, fired, reaching: fired * taken, taken }];
  });
  return {
    fired: kinds.reduce((a, k) => a + k.fired, 0),
    reaching: kinds.reduce((a, k) => a + k.reaching, 0),
    kinds,
  };
}

/** "takes 75% of physical and 60% of energy damage, distortion in full": the armour in words. */
export function armourInWords(armour: Armour): string {
  const parts: string[] = [];
  const whole: string[] = [];
  for (const kind of DAMAGE_KINDS) {
    const share = armour.taken[kind];
    const label = DAMAGE_KIND_LABEL[kind].toLowerCase();
    if (share === 1) whole.push(label);
    else parts.push(`${Math.round(share * 100)}% of ${label}`);
  }
  const partsText =
    parts.length === 0
      ? "every kind of damage in full"
      : `${joinWords(parts)} damage`;
  return whole.length === 0 || parts.length === 0
    ? `takes ${partsText}`
    : `takes ${partsText}, ${joinWords(whole)} in full`;
}

/** "75% of physical and 60% of energy damage gets through": the fact-row form, the full kinds left unsaid. */
export function armourBrief(armour: Armour): string {
  const parts = DAMAGE_KINDS.flatMap((kind) => {
    const share = armour.taken[kind];
    return share === 1
      ? []
      : [
          `${Math.round(share * 100)}% of ${DAMAGE_KIND_LABEL[kind].toLowerCase()}`,
        ];
  });
  return parts.length === 0
    ? "Every kind of damage gets through in full"
    : `${joinWords(parts)} damage gets through`;
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
