import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type PortType, ShipClaim } from "schema";
import { REPO_ROOT } from "./data";
import type { LoadoutEntry, LoadoutGroup } from "./loadout";

/**
 * Helpers for the ship file (ADR-012): one template for every ship, written for a captain or an
 * org deciding on acquisition, professions and battle plans. Everything here is derived from the
 * pack or from CIG's stated claims, never written by hand.
 */

export { ShipClaim };
export type ClaimSection = ShipClaim["section"];

const CLAIMS_FILE = join(
  REPO_ROOT,
  "fixtures",
  "ship-claims",
  "ShipClaim.json",
);

let claims: readonly ShipClaim[] | undefined;

/** CIG's stated claims for a ship (scripts/media/claims.ts checks each quote against its article). */
export function claimsFor(slug: string): readonly ShipClaim[] {
  claims ??= existsSync(CLAIMS_FILE)
    ? ShipClaim.array().parse(JSON.parse(readFileSync(CLAIMS_FILE, "utf8")))
    : [];
  return claims.filter((c) => c.slug === slug);
}

export interface Fact {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
  readonly numeric?: boolean | undefined;
}

export interface Equipment {
  readonly name: string;
  readonly size: number;
  readonly count: number;
}

/** Items mounted on ports of the given types, counted through turrets and racks. */
export function equipment(
  groups: readonly LoadoutGroup[],
  types: readonly PortType[],
): Equipment[] {
  const found = new Map<string, Equipment>();
  const walk = (entries: readonly LoadoutEntry[], multiplier: number): void => {
    for (const entry of entries) {
      const count = entry.count * multiplier;
      if (types.includes(entry.portType) && entry.item !== null) {
        const key = `${entry.item.name}|${entry.item.size}`;
        const prior = found.get(key);
        found.set(key, {
          name: entry.item.name,
          size: entry.item.size,
          count: (prior?.count ?? 0) + count,
        });
      }
      walk(entry.children, count);
    }
  };
  for (const group of groups) walk(group.entries, 1);
  return [...found.values()].sort(
    (a, b) => b.size - a.size || a.name.localeCompare(b.name),
  );
}

/** Ports of the given types, counted through nesting, whatever is mounted. */
export function portCount(
  groups: readonly LoadoutGroup[],
  types: readonly PortType[],
): number {
  let total = 0;
  const walk = (entries: readonly LoadoutEntry[], multiplier: number): void => {
    for (const entry of entries) {
      const count = entry.count * multiplier;
      if (types.includes(entry.portType)) total += count;
      walk(entry.children, count);
    }
  };
  for (const group of groups) walk(group.entries, 1);
  return total;
}

/** "2 × S3 FR-66, 1 × S2 …" */
export function listEquipment(items: readonly Equipment[]): string {
  return items.map((i) => `${i.count} × S${i.size} ${i.name}`).join(", ");
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Rank of `value` among `values`, 1 for the largest. */
export function rankAmong(values: readonly number[], value: number): number {
  return values.filter((v) => v > value).length + 1;
}

/** "longest", "2nd longest" */
export function rankWord(rank: number, word: string): string {
  return rank === 1 ? word : `${ordinal(rank)} ${word}`;
}

export interface Insurance {
  readonly claim_min: number;
  readonly expedite_min: number;
  readonly expedite_auec: number;
}

/**
 * The ship's insurance claim and expedite figures (ADR-013): game data the wiki API serves and the
 * pack keeps in its raw remainder. Times are minutes, as starcitizen.tools labels the same values.
 * Null unless all three are numbers.
 */
export function insuranceOf(raw: unknown): Insurance | null {
  if (typeof raw !== "object" || raw === null) return null;
  const block = (raw as Record<string, unknown>)["insurance"];
  if (typeof block !== "object" || block === null) return null;
  const { claim_time, expedite_time, expedite_cost } = block as Record<
    string,
    unknown
  >;
  return typeof claim_time === "number" &&
    typeof expedite_time === "number" &&
    typeof expedite_cost === "number"
    ? {
        claim_min: claim_time,
        expedite_min: expedite_time,
        expedite_auec: expedite_cost,
      }
    : null;
}
