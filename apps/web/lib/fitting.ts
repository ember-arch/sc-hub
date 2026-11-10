/**
 * The ship fitting list on the ship file (ADR-028): for a ship that carries, what the sheet says
 * fits inside it; for a ship or vehicle, what the sheet says carries it. Community-tested by
 * Pegaxsus in play and copied from the sheet by `scripts/fitting/fetch.ts`; nothing here is a
 * game stat, and the page says whose work it is, for which build, and when it was last updated.
 */

import type { FitCarrier, FitVehicle, FitVerdict, ShipFitList } from "schema";

export const VERDICT_ORDER: readonly FitVerdict[] = [
  "fits",
  "tricks",
  "bugged",
  "no",
  "untested",
];

/** The site's short heading for each verdict; the sheet's own words stand beside it. */
export const VERDICT_LABEL: Readonly<Record<FitVerdict, string>> = {
  fits: "Fits",
  tricks: "Fits with tricks or barely",
  bugged: "Fits but bugged",
  no: "Does not fit",
  untested: "Not tested",
};

export const SLOT_LABEL: Readonly<
  Record<NonNullable<FitCarrier["slot"]>, string>
> = {
  hangar: "hangar",
  cargo: "cargo bay or garage",
  cargo_module: "cargo module",
};

export interface Carried {
  readonly vehicle: FitVehicle;
  readonly verdict: FitVerdict;
  readonly mark: string | null;
  /** The sheet's words for the mark, where its legend has them. */
  readonly note: string | null;
  /** Which space of the carrier, where the sheet splits them. */
  readonly slot: FitCarrier["slot"];
  readonly marker: string | null;
}

export interface CarriedBy {
  readonly carrier: FitCarrier;
  readonly verdict: FitVerdict;
  readonly mark: string | null;
  readonly note: string | null;
}

export interface FittingIndex {
  readonly list: ShipFitList;
  /** The sheet's rows about this ship, as a carrier: one entry per vehicle and space. */
  carries(className: string): Carried[];
  /** The sheet's columns about this ship or vehicle, as something carried. */
  carriedBy(className: string): CarriedBy[];
  /** The sheet's "FITS A FABRICATOR?" row for this ship. */
  fabricator(className: string): FitVerdict | null;
  /** Whether the sheet names this ship at all. */
  knows(className: string): boolean;
}

/** The legend's words for a mark: its own entry, or the entry whose "S/N" names it. */
export function noteFor(
  marks: Readonly<Record<string, string>>,
  mark: string | null,
): string | null {
  if (mark === null) return null;
  if (marks[mark] !== undefined) return marks[mark];
  for (const [key, words] of Object.entries(marks)) {
    if (key.split("/").some((part) => part.trim() === mark)) return words;
  }
  return null;
}

export function buildFittingIndex(list: ShipFitList): FittingIndex {
  const carriersByClass = new Map<string, FitCarrier[]>();
  for (const c of list.carriers)
    for (const cn of c.class_names)
      carriersByClass.set(cn, [...(carriersByClass.get(cn) ?? []), c]);
  const vehiclesByClass = new Map<string, FitVehicle[]>();
  for (const v of list.vehicles)
    for (const cn of v.class_names)
      vehiclesByClass.set(cn, [...(vehiclesByClass.get(cn) ?? []), v]);
  const fitsByCarrier = new Map<number, ShipFitList["fits"]>();
  const fitsByVehicle = new Map<number, ShipFitList["fits"]>();
  for (const f of list.fits) {
    fitsByCarrier.set(f.carrier, [...(fitsByCarrier.get(f.carrier) ?? []), f]);
    fitsByVehicle.set(f.vehicle, [...(fitsByVehicle.get(f.vehicle) ?? []), f]);
  }
  const rank = (v: FitVerdict): number => VERDICT_ORDER.indexOf(v);
  return {
    list,
    carries(className) {
      const out: Carried[] = [];
      for (const carrier of carriersByClass.get(className) ?? []) {
        for (const f of fitsByCarrier.get(carrier.id) ?? []) {
          const vehicle = list.vehicles[f.vehicle];
          if (vehicle === undefined) continue;
          out.push({
            vehicle,
            verdict: f.verdict,
            mark: f.mark,
            note: noteFor(list.legend.marks, f.mark),
            slot: carrier.slot,
            marker: carrier.marker,
          });
        }
      }
      return out.sort(
        (a, b) =>
          rank(a.verdict) - rank(b.verdict) ||
          a.vehicle.row - b.vehicle.row ||
          (a.slot ?? "").localeCompare(b.slot ?? ""),
      );
    },
    carriedBy(className) {
      const out: CarriedBy[] = [];
      for (const vehicle of vehiclesByClass.get(className) ?? []) {
        for (const f of fitsByVehicle.get(vehicle.id) ?? []) {
          const carrier = list.carriers[f.carrier];
          if (carrier === undefined) continue;
          out.push({
            carrier,
            verdict: f.verdict,
            mark: f.mark,
            note: noteFor(list.legend.marks, f.mark),
          });
        }
      }
      return out.sort(
        (a, b) =>
          rank(a.verdict) - rank(b.verdict) ||
          a.carrier.column - b.carrier.column,
      );
    },
    fabricator(className) {
      const carriers = carriersByClass.get(className) ?? [];
      return carriers.find((c) => c.fabricator !== null)?.fabricator ?? null;
    },
    knows(className) {
      return carriersByClass.has(className) || vehiclesByClass.has(className);
    },
  };
}
