"use client";

import { useId, useState } from "react";
import {
  type Armour,
  DAMAGE_KIND_LABEL,
  type DpsByKind,
  type Shields,
  afterArmour,
  armourInWords,
  times,
} from "../../../../lib/armour";

/**
 * After the armour (ADR-026): pick any ship gun on record and see its damage per second, kind by
 * kind, before and after this ship's armour's damage multiplier for that kind; the shields on
 * record are named with their health and regeneration. Every figure is read from the records;
 * the only arithmetic is a product per kind and a sum (`afterArmour`). The records hold more
 * about armour and shields, with no published rule for how the game applies it; none of it is
 * applied, and the caption says so. No colour but the accent: the filled part of each bar is the
 * damage after the multiplier, the whole bar the damage fired, bars to one scale across every gun.
 */

export interface AttackingWeapon {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  /** "Laser repeater", in the game's words, when the record says. */
  readonly kind: string | null;
  readonly dps: DpsByKind;
}

const n0 = (v: number): string =>
  v.toLocaleString("en-US", { maximumFractionDigits: 0 });

const UNAPPLIED =
  "The records' other armour figures (resistance multipliers, deflection, penetration resistance, the ship's penetration multiplier) and the shields' absorption and resistance ranges have no published rule, so no shield stage and nothing beyond the multiplier is applied";

export function ThroughArmour({
  shipName,
  hullHp,
  armour,
  shields,
  weapons,
  defaultId,
  label,
  version,
}: {
  readonly shipName: string;
  readonly hullHp: number | null;
  readonly armour: Armour;
  readonly shields: Shields | null;
  readonly weapons: readonly AttackingWeapon[];
  /** The weapon shown first: the ship's own heaviest stock gun, where it has one. */
  readonly defaultId: string | null;
  readonly label: string;
  readonly version: string | null;
}) {
  const first =
    weapons.find((w) => w.id === defaultId)?.id ?? weapons[0]?.id ?? "";
  const [chosen, setChosen] = useState(first);
  const captionId = useId();
  const weapon = weapons.find((w) => w.id === chosen) ?? null;
  const result = weapon === null ? null : afterArmour(weapon.dps, armour);
  // One scale for every gun on the list, so a heavier gun shows a longer bar.
  const widest = Math.max(1, ...weapons.flatMap((w) => Object.values(w.dps)));
  const sizes = [...new Set(weapons.map((w) => w.size))].sort((a, b) => a - b);

  return (
    <figure className="m-0 flex flex-col gap-3" aria-describedby={captionId}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 max-w-full items-center gap-2 text-caption text-secondary">
          <span className="shrink-0">Fired on by</span>
          <select
            aria-label="Fired on by"
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className="min-w-0 max-w-full rounded-pill border border-hairline-strong bg-surface px-3 py-1 text-caption text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {sizes.map((size) => (
              <optgroup key={size} label={`Size ${size}`}>
                {weapons
                  .filter((w) => w.size === size)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.kind === null ? "" : `, ${w.kind.toLowerCase()}`}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-inset p-4">
        <p className="m-0 text-caption text-secondary">
          {shields === null
            ? "No shields on record"
            : `Shields on record: ${n0(shields.hp)} HP${shields.regen === null ? "" : `, regenerating ${n0(shields.regen)} HP/s`}${shields.faceType === null ? "" : ` (${shields.faceType.toLowerCase()})`}`}
          {hullHp === null ? "" : `; hull ${n0(hullHp)} HP`}
          {armour.hp === null ? "" : `; armour ${n0(armour.hp)} HP`}
        </p>
        {result === null || weapon === null ? (
          <p className="m-0 text-caption text-secondary">
            No ship gun on record deals damage to show.
          </p>
        ) : (
          <dl className="m-0 flex flex-col gap-3">
            {result.kinds.map((k) => (
              <div key={k.kind} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <dt className="text-ui text-secondary">
                    {DAMAGE_KIND_LABEL[k.kind]}
                  </dt>
                  <dd className="m-0 text-ui text-primary">
                    <span className="font-mono">{n0(k.fired)}</span>
                    <span className="text-caption text-secondary">
                      {" "}
                      per second fired ·{" "}
                    </span>
                    <span className="font-mono">{n0(k.after)}</span>
                    <span className="text-caption text-secondary">
                      {" "}
                      after the armour ({times(k.multiplier)})
                    </span>
                  </dd>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-pill bg-hairline"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-pill bg-hairline-strong"
                    style={{ width: `${(k.fired / widest) * 100}%` }}
                  >
                    <div
                      className="h-full rounded-pill bg-accent"
                      style={{ width: `${Math.min(1, k.multiplier) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline pt-3">
              <dt className="text-ui text-primary">All damage</dt>
              <dd className="m-0 text-ui text-primary">
                <span className="font-mono">{n0(result.fired)}</span>
                <span className="text-caption text-secondary">
                  {" "}
                  per second fired ·{" "}
                </span>
                <span className="font-mono">{n0(result.after)}</span>
                <span className="text-caption text-secondary">
                  {" "}
                  after the armour
                </span>
              </dd>
            </div>
          </dl>
        )}
      </div>
      <figcaption id={captionId} className="text-caption text-secondary">
        <span className="font-mono text-primary">{label}</span> After the
        armour: a {weapon === null ? "gun" : weapon.name}&apos;s damage per
        second as its record gives it, and the same times the {shipName}&apos;s
        armour&apos;s damage multiplier for each kind. Its armour{" "}
        {armourInWords(armour)}. {UNAPPLIED}
        {version === null ? "" : `. LIVE ${version}`}
      </figcaption>
    </figure>
  );
}
