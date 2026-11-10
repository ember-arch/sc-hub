"use client";

import { useId, useState } from "react";
import {
  type Armour,
  DAMAGE_KIND_LABEL,
  type DpsByKind,
  type Shields,
  armourInWords,
  throughArmour,
} from "../../../../lib/armour";

/**
 * Through the armour (ADR-026): pick any ship gun on record and see how much of its damage per
 * second reaches this ship's hull, kind by kind, once the armour has taken its share; the shields
 * stand in front and are named with their health and regeneration. Every figure is read from the
 * records; the only arithmetic is a product per kind and a sum (`throughArmour`). No colour but
 * the accent: the filled part of each bar is what gets through, the rest what the armour takes.
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
const pct = (share: number): string => `${Math.round(share * 100)}%`;

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
  const through = weapon === null ? null : throughArmour(weapon.dps, armour);
  const widest =
    through === null ? 1 : Math.max(1, ...through.kinds.map((k) => k.fired));
  const sizes = [...new Set(weapons.map((w) => w.size))].sort((a, b) => a - b);

  return (
    <figure className="m-0 flex flex-col gap-3" aria-describedby={captionId}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-caption text-secondary">
          <span>Fired on by</span>
          <select
            aria-label="Fired on by"
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className="rounded-pill border border-hairline-strong bg-surface px-3 py-1 text-caption text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
            ? "No shields on record: the armour is the first thing hit"
            : `Shields first: ${n0(shields.hp)} HP${shields.regen === null ? "" : `, regenerating ${n0(shields.regen)} HP/s`}${shields.faceType === null ? "" : ` (${shields.faceType.toLowerCase()})`}, then the armour`}
        </p>
        {through === null || weapon === null ? (
          <p className="m-0 text-caption text-secondary">
            No ship gun on record deals damage to show.
          </p>
        ) : (
          <dl className="m-0 flex flex-col gap-3">
            {through.kinds.map((k) => (
              <div key={k.kind} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <dt className="text-ui text-secondary">
                    {DAMAGE_KIND_LABEL[k.kind]}
                  </dt>
                  <dd className="m-0 text-ui text-primary">
                    <span className="font-mono">{n0(k.fired)}</span>
                    <span className="text-caption text-secondary">
                      {" "}
                      per s fired ·{" "}
                    </span>
                    <span className="font-mono">{n0(k.reaching)}</span>
                    <span className="text-caption text-secondary">
                      {" "}
                      reaches the hull ({pct(k.taken)})
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
                      style={{ width: `${k.taken * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline pt-3">
              <dt className="text-ui text-primary">All damage</dt>
              <dd className="m-0 text-ui text-primary">
                <span className="font-mono">{n0(through.fired)}</span>
                <span className="text-caption text-secondary">
                  {" "}
                  per s fired ·{" "}
                </span>
                <span className="font-mono">{n0(through.reaching)}</span>
                <span className="text-caption text-secondary">
                  {" "}
                  reaches the hull
                  {hullHp === null ? "" : ` of ${n0(hullHp)} HP`}
                </span>
              </dd>
            </div>
          </dl>
        )}
      </div>
      <figcaption id={captionId} className="text-caption text-secondary">
        <span className="font-mono text-primary">{label}</span> Through the
        armour: of a {weapon === null ? "gun" : weapon.name}&apos;s damage per
        second, what reaches the {shipName}&apos;s hull. Its armour{" "}
        {armourInWords(armour)}
        {armour.hp === null ? "" : `, and has ${n0(armour.hp)} HP of its own`}.
        Shields take the hit whole before the armour; penetration and the
        shields&apos; resistances are in the records but their rules are not
        published, so they are not applied
        {version === null ? "" : `. LIVE ${version}`}
      </figcaption>
    </figure>
  );
}
