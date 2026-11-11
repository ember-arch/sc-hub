import type { VehicleStatus } from "schema";

/**
 * Ships on record (ADR-046): the register's entries and RSI's concept ships, which the game data
 * does not hold, counted once for the home page and the ships index. Every status present is
 * named, so the parts always add up to the total.
 */

export interface ShipTally {
  readonly total: number;
  readonly parts: readonly { readonly label: string; readonly count: number }[];
}

const LABELS: Readonly<Record<VehicleStatus, string>> = {
  flight_ready: "flight ready",
  in_production: "in production",
  concept: "in concept",
};

export function shipTally(
  entries: readonly { readonly vehicle: { readonly status: VehicleStatus } }[],
  conceptCount: number,
): ShipTally {
  const counts: Record<VehicleStatus, number> = {
    flight_ready: 0,
    in_production: 0,
    concept: conceptCount,
  };
  for (const e of entries) counts[e.vehicle.status] += 1;
  return {
    total: entries.length + conceptCount,
    parts: (Object.keys(LABELS) as VehicleStatus[])
      .filter((status) => counts[status] > 0)
      .map((status) => ({ label: LABELS[status], count: counts[status] })),
  };
}

/** "231 flight ready · 29 in concept". */
export function tallyNote(tally: ShipTally): string {
  return tally.parts.map((p) => `${p.count} ${p.label}`).join(" · ");
}
