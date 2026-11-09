import { repo } from "./data";
import { type LoadoutTotals, editorModel, totals } from "./loadout-editor";

/**
 * What a ship's stock loadout adds up to (ADR-016): gun damage per second and per volley, missile
 * damage, shields, power and quantum drive, summed by the loadout editor's own rules from the
 * parts' records. Used to rank a build against the other ships and on the compare page. Null for
 * a ship with no swappable ports on record (a concept ship).
 */

const cache = new Map<string, LoadoutTotals | null>();

export function stockCombat(className: string): LoadoutTotals | null {
  if (cache.has(className)) return cache.get(className) ?? null;
  const r = repo();
  const model = editorModel(r.shipPorts(className), r.components);
  const sums =
    model.slots.length === 0 ? null : totals(model.slots, {}, model.options);
  cache.set(className, sums);
  return sums;
}

/** A ship's stock sums with its name, for ranking a build among the ships on record. */
export interface CombatPeer {
  readonly key: string;
  readonly name: string;
  readonly gunDps: number;
  readonly gunAlpha: number;
  readonly missileDamage: number;
  readonly shieldHp: number;
}

/** Every entry on record with a stock build, except the one named (editions are not peers). */
export function combatPeers(exceptClassName: string | null): CombatPeer[] {
  return repo().entries.flatMap((s) => {
    if (s.vehicle.class_name === exceptClassName) return [];
    const t = stockCombat(s.vehicle.class_name);
    return t === null
      ? []
      : [
          {
            key: s.vehicle.class_name,
            name: s.vehicle.name,
            gunDps: t.gunDps,
            gunAlpha: t.gunAlpha,
            missileDamage: t.missileDamage,
            shieldHp: t.shieldHp,
          },
        ];
  });
}
