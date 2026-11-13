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

/**
 * The legend's words for a mark: its own entry, or the entry whose pair ("S/N") names it. The
 * sheet can use one letter twice: "S" is the 890 Jump's "Safe to Land" (its "S/N" pair) and,
 * since 12 Nov 2026, the Galaxy's "needs vehicle support for lifting". So where a mark has its
 * own entry and a pair names it too, the pair stands on a carrier column that also uses the
 * pair's other letter, and its own entry everywhere else. `column` is the marks of the
 * carrier's column.
 */
export function noteFor(
  marks: Readonly<Record<string, string>>,
  mark: string | null,
  column: ReadonlySet<string> = new Set(),
): string | null {
  if (mark === null) return null;
  const own = marks[mark];
  for (const [key, words] of Object.entries(marks)) {
    const parts = key.split("/").map((part) => part.trim());
    if (parts.length < 2 || !parts.includes(mark)) continue;
    if (own === undefined) return words;
    if (parts.some((part) => part !== mark && column.has(part))) return words;
  }
  return own ?? null;
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
  const columnMarks = new Map<number, Set<string>>();
  for (const f of list.fits)
    if (f.mark !== null)
      columnMarks.set(
        f.carrier,
        (columnMarks.get(f.carrier) ?? new Set()).add(f.mark),
      );
  // Words that open with another verdict's own words ("Good Fit, but…" on a red cell) would
  // contradict the cell's colour; the mark is then shown as written, like a mark the legend
  // does not explain.
  const verdictWords = Object.entries(list.legend.verdicts) as [
    FitVerdict,
    string,
  ][];
  const note = (f: ShipFitList["fits"][number]): string | null => {
    const words = noteFor(
      list.legend.marks,
      f.mark,
      columnMarks.get(f.carrier),
    );
    if (words === null) return null;
    const opens = (w: string): boolean =>
      words.toLowerCase().startsWith(w.toLowerCase());
    return verdictWords.some(
      ([v, w]) => v !== f.verdict && w !== "" && opens(w),
    )
      ? null
      : words;
  };
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
            note: note(f),
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
            note: note(f),
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
