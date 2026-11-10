import { z } from "zod";
import { ClassName, Timestamp } from "../common.js";

/**
 * The ship fitting list (ADR-028): which ships and ground vehicles fit inside which ships, as
 * Pegaxsus tests it in play and keeps it in a public spreadsheet, patch by patch. Not game data:
 * community-tested, copied by `scripts/fitting/fetch.ts` from the sheet's own cells and legend,
 * never typed in, and shown with the author, the build and a link, never as a game stat.
 */

/** The sheet's legend, read from its colours: a good fit, fits with tricks or barely, fits but bugged, does not fit, not tested. */
export const FitVerdict = z.enum([
  "fits",
  "tricks",
  "bugged",
  "no",
  "untested",
]);
export type FitVerdict = z.infer<typeof FitVerdict>;

/** A column of the sheet: a ship that carries, and which space of it where the sheet splits them. */
export const FitCarrier = z.strictObject({
  id: z.number().int().nonnegative(),
  /** The sheet's own heading. */
  label: z.string().min(1),
  column: z.number().int().nonnegative(),
  /** The sheet's H (hangar), C (cargo or garage) or CM (cargo module) marker, or none. */
  slot: z.enum(["hangar", "cargo", "cargo_module"]).nullable(),
  /** The marker as written, where it is not one of those. */
  marker: z.string().nullable(),
  /** Listed under the sheet's "UNRELEASED" heading. */
  unreleased: z.boolean(),
  /** The pack ships the heading names; empty where the pack has none (a concept ship). */
  class_names: z.array(ClassName),
  /** The sheet's "FITS A FABRICATOR?" row, where it says. */
  fabricator: FitVerdict.nullable(),
});
export type FitCarrier = z.infer<typeof FitCarrier>;

/** A row of the sheet: a ship or ground vehicle that is carried. */
export const FitVehicle = z.strictObject({
  id: z.number().int().nonnegative(),
  label: z.string().min(1),
  maker_label: z.string().nullable(),
  row: z.number().int().nonnegative(),
  group: z.enum(["ship", "ground"]),
  class_names: z.array(ClassName),
});
export type FitVehicle = z.infer<typeof FitVehicle>;

/** One cell: the verdict from the cell's colour, and the mark written in it, if any. */
export const ShipFit = z.strictObject({
  carrier: z.number().int().nonnegative(),
  vehicle: z.number().int().nonnegative(),
  verdict: FitVerdict,
  /** "*", "E", "UD", "S", "Front" and the like, as written; the legend explains some. */
  mark: z.string().nullable(),
});
export type ShipFit = z.infer<typeof ShipFit>;

export const ShipFitList = z.strictObject({
  source: z.strictObject({
    title: z.string().min(1),
    url: z.url(),
    author: z.string().min(1),
    sheet: z.string().min(1),
    /** The sheet's own build heading, for example "PRE LIVE 4.10.3". */
    build_label: z.string().min(1),
    /** The date of the sheet's "UNDER CONSTRUCTION" band over this build's list, where it has one. */
    under_construction: z.iso.date().nullable(),
    /** The sheet's "LAST UPDATE" date. */
    last_update: z.iso.date(),
    /** The author's answer on reuse, the owner's to record (ADR-028). */
    consent: z.enum(["pending", "granted"]),
  }),
  fetched_at: Timestamp,
  legend: z.strictObject({
    /** The sheet's words for each verdict. */
    verdicts: z.record(FitVerdict, z.string()),
    /** The sheet's words for each mark it explains. */
    marks: z.record(z.string(), z.string()),
  }),
  carriers: z.array(FitCarrier).min(1),
  vehicles: z.array(FitVehicle).min(1),
  fits: z.array(ShipFit).min(1),
});
export type ShipFitList = z.infer<typeof ShipFitList>;
