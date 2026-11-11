/**
 * Pitch, yaw and roll (ADR-043): how fast a ship turns about each axis, in degrees per second,
 * and the same with the afterburner, as the vehicle's record gives them in its `agility` block
 * (the Wiki API's figures, kept in `VehicleStats.raw` like the armour, ADR-026). Nothing is
 * computed: the record's six figures are read, checked for shape, and shown. A vehicle whose
 * record gives no turn rate for an axis (null on the 32 ground vehicles and suits of this pack)
 * has none.
 */
import { formatNumber } from "ui";

export const AXES = ["pitch", "yaw", "roll"] as const;
export type Axis = (typeof AXES)[number];

export const AXIS_LABEL: Readonly<Record<Axis, string>> = {
  pitch: "Pitch",
  yaw: "Yaw",
  roll: "Roll",
};

export interface Turn {
  /** Degrees per second about the axis. */
  readonly rate: number;
  /** The same with the afterburner, when the record gives it. */
  readonly boosted: number | null;
}

export type Agility = Readonly<Record<Axis, Turn>>;

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const positive = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/** The record's turn rates: all three axes above zero, or nothing. */
export function agilityOf(raw: unknown): Agility | null {
  const block = obj(obj(raw)?.["agility"]);
  if (block === null) return null;
  const turns: Partial<Record<Axis, Turn>> = {};
  for (const axis of AXES) {
    const rate = positive(block[axis]);
    if (rate === null) return null;
    turns[axis] = { rate, boosted: positive(block[`${axis}_boosted`]) };
  }
  return turns as Agility;
}

/** "68 °/s, 81.6 boosted": a turn as a fact's value, to the site's two decimals at most. */
export function formatTurn(turn: Turn): string {
  return turn.boosted === null
    ? `${formatNumber(turn.rate, 2)} °/s`
    : `${formatNumber(turn.rate, 2)} °/s, ${formatNumber(turn.boosted, 2)} boosted`;
}
