"use client";

import { useId, useState } from "react";
import { Icon, type IconName } from "ui";
import {
  DAMAGE_KIND_LABEL,
  type DamageKind,
  type DpsByKind,
  type Shields,
  times,
} from "../../../../lib/armour";
import {
  type Mitigation,
  type PathStage,
  damagePath,
  hasShieldShares,
  perSecondToHull,
} from "../../../../lib/damage-path";

/**
 * The damage path (ADR-026, amended on the owner's SPViewer example): pick any ship gun on
 * record and shields up or down, and see one shot of each kind it deals go stage by stage into
 * this ship: what the shields take, what passes them, what the armour's own health takes, what
 * the hull takes, and what the components would take with no armour left. Above it, the ship's
 * mitigation figures as the record gives them. Every stage is a product of the shot and one
 * record figure, on CIG's published statements (see `damage-path.ts`); the deflection figure is
 * shown beside a shot that falls below it and applied to nothing.
 */

export interface AttackingWeapon {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  /** "Laser repeater", in the game's words, when the record says. */
  readonly kind: string | null;
  /** Damage per shot by kind, and per second. */
  readonly shot: DpsByKind;
  readonly dps: DpsByKind;
}

const n0 = (v: number): string =>
  v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const n1 = (v: number): string =>
  v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 1 : 0 });
const pct = (share: number): string => `${Math.round(share * 100)}%`;

/** The glyph beside each kind the guns deal, and beside each stage of the path (ADR-044). */
const KIND_ICON: Partial<Readonly<Record<DamageKind, IconName>>> = {
  physical: "physical",
  energy: "energy",
  distortion: "distortion",
};

/** The kinds the mitigation table shows: the three the game's guns deal. */
const SHOWN_KINDS: readonly DamageKind[] = ["physical", "energy", "distortion"];

export function DamagePath({
  shipName,
  mitigation,
  hullHp,
  shields,
  weapons,
  defaultId,
  label,
  version,
}: {
  readonly shipName: string;
  readonly mitigation: Mitigation;
  readonly hullHp: number | null;
  readonly shields: Shields | null;
  readonly weapons: readonly AttackingWeapon[];
  readonly defaultId: string | null;
  readonly label: string;
  readonly version: string | null;
}) {
  const first =
    weapons.find((w) => w.id === defaultId)?.id ?? weapons[0]?.id ?? "";
  const [chosen, setChosen] = useState(first);
  // The switch exists only where the record gives the shields a share to absorb.
  const shares = shields !== null && hasShieldShares(mitigation);
  const [shieldsUp, setShieldsUp] = useState(shares);
  const captionId = useId();
  const weapon = weapons.find((w) => w.id === chosen) ?? null;
  const stages =
    weapon === null ? [] : damagePath(weapon.shot, mitigation, shieldsUp);
  const sizes = [...new Set(weapons.map((w) => w.size))].sort((a, b) => a - b);
  const m = mitigation;

  const option =
    "rounded-pill border px-3 py-1 text-caption transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const choice = (on: boolean) =>
    `${option} ${on ? "border-accent bg-accent-bg text-primary" : "border-hairline-strong text-secondary hover:text-primary"}`;

  const cell = (value: number | null, how: (v: number) => string) =>
    value === null ? "" : how(value);
  const rows: {
    label: string;
    icon: IconName;
    value: (kind: DamageKind) => string;
  }[] = [
    {
      label: "Shield absorption",
      icon: "shield",
      value: (k) =>
        m.shieldAbsorption === null ? "" : pct(m.shieldAbsorption[k].max),
    },
    {
      label: "Shield resistance",
      icon: "shield",
      value: (k) =>
        m.shieldResistance === null ? "" : pct(m.shieldResistance[k].max),
    },
    {
      label: "Deflection figure, per shot",
      icon: "armour",
      value: (k) =>
        cell(m.deflection?.[k] ?? null, (v) => (v === 0 ? "" : n0(v))),
    },
    {
      label: "Armour pool takes",
      icon: "armour",
      value: (k) => cell(m.armourDurability?.[k] ?? null, times),
    },
    { label: "Hull takes", icon: "hull", value: (k) => times(m.hull[k]) },
    {
      label: "Components take, no armour left",
      icon: "components",
      value: () => cell(m.components, times),
    },
  ];

  const stageCells = (p: PathStage) =>
    (
      [
        {
          name: "Per shot",
          icon: KIND_ICON[p.kind] ?? "shot",
          value: n1(p.shot),
        },
        {
          name:
            shieldsUp || !shares ? "To the shields" : "To the shields (down)",
          icon: "shield",
          value: n1(p.shields),
        },
        { name: "Through to the ship", icon: "through", value: n1(p.passed) },
        {
          name: "Armour pool takes",
          icon: "armour",
          value: p.armour === null ? "" : n1(p.armour),
        },
        { name: "Hull takes", icon: "hull", value: n1(p.hull) },
        {
          name: "Components, no armour left",
          icon: "components",
          value: p.components === null ? "" : n1(p.components),
        },
      ] as const satisfies readonly {
        name: string;
        icon: IconName;
        value: string;
      }[]
    ).filter((c) => c.value !== "");

  return (
    <figure className="m-0 flex flex-col gap-3" aria-describedby={captionId}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
        {!shares ? null : (
          <div
            role="group"
            aria-label="Shields"
            className="flex items-center gap-2"
          >
            <span className="text-caption text-secondary">Shields</span>
            <button
              type="button"
              aria-pressed={shieldsUp}
              className={choice(shieldsUp)}
              onClick={() => setShieldsUp(true)}
            >
              Up
            </button>
            <button
              type="button"
              aria-pressed={!shieldsUp}
              className={choice(!shieldsUp)}
              onClick={() => setShieldsUp(false)}
            >
              Down
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-card bg-inset p-4">
        <p className="m-0 text-caption text-secondary">
          {shields === null
            ? "No shields on record"
            : `Shields ${n0(shields.hp)} HP${shields.regen === null ? "" : `, regenerating ${n0(shields.regen)} HP/s`}${shields.faceType === null ? "" : ` (${shields.faceType.toLowerCase()})`}`}
          {hullHp === null ? "" : `; hull ${n0(hullHp)} HP`}
          {m.armour.hp === null ? "" : `; armour ${n0(m.armour.hp)} HP`}
          {shields !== null && !shares
            ? ". Its record gives the shields no share of any kind to absorb, so the path starts at the armour"
            : ""}
        </p>

        <table className="w-full border-collapse text-ui">
          <caption className="sr-only">
            The {shipName}&apos;s damage mitigation figures, from its record
          </caption>
          <thead>
            <tr className="border-b border-hairline text-left text-caption text-secondary">
              <th scope="col" className="py-1 pr-3 font-normal">
                Figure
              </th>
              {SHOWN_KINDS.map((k) => (
                <th
                  key={k}
                  scope="col"
                  className="py-1 pl-3 text-right font-normal"
                >
                  <span className="inline-flex items-center gap-1">
                    {/* The table's glyphs from sm: on a phone its numbers need the width. */}
                    {KIND_ICON[k] === undefined ? null : (
                      <span
                        aria-hidden="true"
                        className="hidden sm:inline-flex"
                      >
                        <Icon name={KIND_ICON[k]!} />
                      </span>
                    )}
                    {DAMAGE_KIND_LABEL[k]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-hairline">
                <th
                  scope="row"
                  className="py-1 pr-3 text-left font-normal text-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="hidden sm:inline-flex">
                      <Icon name={row.icon} />
                    </span>
                    {row.label}
                  </span>
                </th>
                {SHOWN_KINDS.map((k) => (
                  <td
                    key={k}
                    className="py-1 pl-3 text-right font-mono text-primary"
                  >
                    {row.value(k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {weapon === null || stages.length === 0 ? (
          <p className="m-0 text-caption text-secondary">
            No ship gun on record deals damage to show.
          </p>
        ) : (
          stages.map((p) => (
            <div key={p.kind} className="flex flex-col gap-2">
              <p className="m-0 flex items-center gap-2 text-caption text-secondary">
                {KIND_ICON[p.kind] === undefined ? null : (
                  <Icon name={KIND_ICON[p.kind]!} className="text-primary" />
                )}
                One {DAMAGE_KIND_LABEL[p.kind].toLowerCase()} shot of the{" "}
                {weapon.name}
                {p.belowDeflection === null
                  ? ""
                  : `, below the record's deflection figure of ${n0(p.belowDeflection)}`}
              </p>
              {/* The stages in order, each with its glyph; from md a chevron leads to the next. */}
              <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-6">
                {stageCells(p).map((c, i, all) => (
                  <div
                    key={c.name}
                    className="relative flex flex-col gap-1 border-t border-hairline pt-2"
                  >
                    {i === all.length - 1 ? null : (
                      <span
                        aria-hidden="true"
                        className="absolute -right-4 top-2 hidden text-muted md:block"
                      >
                        <Icon name="next" />
                      </span>
                    )}
                    <dt className="flex items-start gap-1 text-caption text-secondary">
                      <Icon name={c.icon} className="text-primary" />
                      {c.name}
                    </dt>
                    <dd className="m-0 font-mono text-ui text-primary">
                      {c.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {weapon.dps[p.kind] === undefined ? null : (
                <p className="m-0 text-caption text-secondary">
                  At {n0(weapon.dps[p.kind]!)} per second fired, the hull takes{" "}
                  {n0(perSecondToHull(weapon.dps[p.kind]!, p, m))} per second
                  {shieldsUp ? " while the shields hold" : ""}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <figcaption id={captionId} className="text-caption text-secondary">
        <span className="font-mono text-primary">{label}</span> The damage path:
        one shot of the chosen gun into the {shipName}, each stage the shot
        times one figure from the ship&apos;s record, on what CIG has published:
        shields absorb a share of each kind while up (45% of ballistic, Alpha
        4.3.1) and resist a share of that; energy does more to the armour and
        ballistic sends more through it; components behind the hull take a share
        of what penetrates, most with no armour left (Alpha 4.5.0). Shown at
        full shields. Which record field each sentence means is SPViewer&apos;s
        reading, consistent with the records; CIG names none. The deflection
        figure has no published rule, so it is named beside a shot that falls
        below it and applied to nothing; the armour left over a fight, the
        penetration cone and shield faces are not modelled
        {version === null ? "" : `. LIVE ${version}`}
      </figcaption>
    </figure>
  );
}
