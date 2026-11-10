import {
  type Armour,
  DAMAGE_KINDS,
  type DamageKind,
  type DpsByKind,
  armourOf,
} from "./armour";

/**
 * The damage path (ADR-026, amended): what a shot of each kind of damage does on its way into a
 * ship, stage by stage, from the ship's own record and CIG's published statements about the
 * system, and nothing further:
 *
 * - Shields absorb a share of each kind while they are up (CIG, Alpha 4.3.1: "Shield ballistic
 *   absorption reduction damage has now been set to 45% for all shields"); the rest passes
 *   through to the ship. The record's `shield.absorption` holds that share per kind.
 * - Shields resist a share of what they absorb (CIG, Alpha 4.5.0: "Shield energy weapon
 *   resistances updated (shields take slightly more energy damage)"); `shield.resistance`.
 * - The armour's own health takes damage at a multiplier per kind, and energy hurts it more
 *   (CIG, 4.5.0: "Energy weapons deal more damage against armor"); `armor.resistance_multiplier`.
 * - The hull takes damage at a multiplier per kind, and ballistic passes through more (CIG,
 *   4.5.0: "ballistic weapons send more damage through armor"); `armor.damage_multiplier`.
 * - Components behind the hull take a share of what penetrates, and penetration scales with the
 *   armour left (CIG, 4.5.0: "100% armor = no penetration, 0% = maximum"); the record's
 *   `penetration_multiplier.components` is that share, shown here at its maximum, no armour left.
 * - The record's `armor.deflection` is a per-shot damage figure per kind; CIG has not published
 *   its rule, so it is shown beside a shot that falls below it and applied to nothing.
 *
 * Every stage is one product of the shot and a record figure; the stages are not chained beyond
 * what the statements above say (the hull's share is of what passed the shields). Absorption and
 * resistance are taken at their maximum, full shields. Which record field each sentence names
 * is SPViewer's reading, consistent with the data (the armour-pool multiplier is above 1 for
 * energy on every ship, the hull multiplier above for physical); CIG names no field.
 *
 * Fifteen shielded ground vehicles (720 HP shields) carry no absorption or resistance figures in
 * their record: for them the shields stand aside and the path starts at the armour, said so.
 */

export interface Range {
  readonly min: number;
  readonly max: number;
}

export interface Mitigation {
  /** The share of each kind the shields absorb while up, at full shields; null without shields. */
  readonly shieldAbsorption: Readonly<Record<DamageKind, Range>> | null;
  /** The share of absorbed damage the shields resist; null without shields. */
  readonly shieldResistance: Readonly<Record<DamageKind, Range>> | null;
  /** The record's per-shot deflection figure per kind; 0 where the record has none. */
  readonly deflection: Readonly<Record<DamageKind, number>> | null;
  /** The armour's own damage multiplier per kind. */
  readonly armourDurability: Readonly<Record<DamageKind, number>> | null;
  /** The hull's damage multiplier per kind (the armour's `damage_multiplier`). */
  readonly hull: Readonly<Record<DamageKind, number>>;
  /** The share of penetrating damage the components take, with no armour left. */
  readonly components: number | null;
  readonly armour: Armour;
}

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function perKind(map: unknown): Record<DamageKind, number> | null {
  const m = obj(map);
  if (m === null) return null;
  const out: Partial<Record<DamageKind, number>> = {};
  for (const kind of DAMAGE_KINDS) {
    const v = num(m[kind]);
    if (v === null) return null;
    out[kind] = v;
  }
  return out as Record<DamageKind, number>;
}

function rangesPerKind(map: unknown): Record<DamageKind, Range> | null {
  const m = obj(map);
  if (m === null) return null;
  const out: Partial<Record<DamageKind, Range>> = {};
  for (const kind of DAMAGE_KINDS) {
    const r = obj(m[kind]);
    const min = num(r?.["minimum"]);
    const max = num(r?.["maximum"]);
    if (min === null || max === null) return null;
    out[kind] = { min, max };
  }
  return out as Record<DamageKind, Range>;
}

/** The ship record's mitigation figures; null where it has no armour record. */
export function mitigationOf(raw: unknown): Mitigation | null {
  const armour = armourOf(raw);
  if (armour === null) return null;
  const r = obj(raw);
  const armor = obj(r?.["armor"]);
  const shield = obj(r?.["shield"]);
  const hasShields = (num(shield?.["hp"]) ?? 0) > 0;
  return {
    shieldAbsorption: hasShields ? rangesPerKind(shield?.["absorption"]) : null,
    shieldResistance: hasShields ? rangesPerKind(shield?.["resistance"]) : null,
    deflection: perKind(armor?.["deflection"]),
    armourDurability: perKind(armor?.["resistance_multiplier"]),
    hull: armour.multiplier,
    components: num(obj(r?.["penetration_multiplier"])?.["components"]),
    armour,
  };
}

/** A weapon record's damage per shot by kind; null for a part that deals none. */
export function alphaByKindOf(raw: unknown): DpsByKind | null {
  const alpha = obj(
    obj(obj(obj(raw)?.["vehicle_weapon"])?.["damage"])?.["alpha"],
  );
  if (alpha === null) return null;
  const out: Partial<Record<DamageKind, number>> = {};
  for (const kind of DAMAGE_KINDS) {
    const v = num(alpha[kind]);
    if (v !== null && v > 0) out[kind] = v;
  }
  return Object.keys(out).length === 0 ? null : out;
}

export interface PathStage {
  readonly kind: DamageKind;
  /** Damage per shot of this kind. */
  readonly shot: number;
  /** What the shields take of it (absorbed, less what they resist); 0 with shields down. */
  readonly shields: number;
  /** What passes the shields toward the ship. */
  readonly passed: number;
  /** What the armour's own health takes of the passed damage; null without the figure. */
  readonly armour: number | null;
  /** What the hull takes of the passed damage. */
  readonly hull: number;
  /** What the components would take of the passed damage with no armour left; null without the figure. */
  readonly components: number | null;
  /** The record's deflection figure for the kind, when the shot falls below it; else null. */
  readonly belowDeflection: number | null;
}

/** Whether the record gives the shields a share of each kind to absorb. */
export function hasShieldShares(m: Mitigation): boolean {
  return m.shieldAbsorption !== null;
}

/** Damage per second the hull takes at this rate of fire, on the same stage figures. */
export function perSecondToHull(
  dps: number,
  stage: PathStage,
  m: Mitigation,
): number {
  return dps * (stage.passed / stage.shot) * m.hull[stage.kind];
}

/** One shot of each kind the weapon deals, stage by stage. */
export function damagePath(
  shot: DpsByKind,
  m: Mitigation,
  shieldsUp: boolean,
): PathStage[] {
  return DAMAGE_KINDS.flatMap((kind) => {
    const a = shot[kind] ?? 0;
    if (a <= 0) return [];
    const absorb =
      shieldsUp && m.shieldAbsorption !== null
        ? m.shieldAbsorption[kind].max
        : 0;
    const resist =
      shieldsUp && m.shieldResistance !== null
        ? m.shieldResistance[kind].max
        : 0;
    const absorbed = a * absorb;
    const passed = a - absorbed;
    const deflection = m.deflection?.[kind] ?? 0;
    return [
      {
        kind,
        shot: a,
        shields: absorbed * (1 - resist),
        passed,
        armour:
          m.armourDurability === null
            ? null
            : passed * m.armourDurability[kind],
        hull: passed * m.hull[kind],
        components: m.components === null ? null : passed * m.components,
        belowDeflection: deflection > 0 && a < deflection ? deflection : null,
      },
    ];
  });
}
