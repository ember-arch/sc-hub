import { z } from "zod";
import { ClassName, GameVersionString, Timestamp } from "../common.js";
import { Channel } from "../enums.js";

/**
 * A build's figures, kept so any two builds can be compared (ADR-049): one file per build in
 * `fixtures/patches/`, written by `scripts/patches/fetch.ts`. It holds only what a comparison
 * reads (each record's figures as the source states them, flattened to dotted paths, and each
 * ship's stock loadout), not whole records, so twelve builds stay a few megabytes.
 */

/** One figure as the source states it: a number, a short string or a flag. Absent means not stated. */
export const PatchValue = z.union([z.number(), z.string(), z.boolean()]);
export type PatchValue = z.infer<typeof PatchValue>;

/** Figures by dotted path into the source record, for example `speed.scm` or `armor.health`. */
export const PatchFigures = z.record(z.string().min(1), PatchValue);
export type PatchFigures = z.infer<typeof PatchFigures>;

export const PatchShip = z.strictObject({
  name: z.string().min(1),
  /** The name the game shows, maker first ("Aegis Gladius"); what patch notes call the ship. */
  game_name: z.string().min(1).nullable(),
  /** Manufacturer code, for example `AEGS`. */
  manufacturer: z.string().min(1).nullable(),
  figures: PatchFigures,
  /** The part fitted at each port, by port path (parent names joined by `/`), as a class name. */
  loadout: z.record(z.string().min(1), ClassName),
});
export type PatchShip = z.infer<typeof PatchShip>;

export const PatchPart = z.strictObject({
  name: z.string().min(1),
  /** The source's type, for example `WeaponGun`, `Shield`, `QuantumDrive`. */
  type: z.string().min(1),
  sub_type: z.string().min(1).nullable(),
  size: z.number().int().nullable(),
  grade: z.string().min(1).nullable(),
  manufacturer: z.string().min(1).nullable(),
  figures: PatchFigures,
});
export type PatchPart = z.infer<typeof PatchPart>;

export const PatchIngredient = z.strictObject({
  amount: z.number(),
  /** Resources are measured in SCU, items are counted. */
  unit: z.enum(["SCU", "each"]),
});
export type PatchIngredient = z.infer<typeof PatchIngredient>;

export const PatchBlueprint = z.strictObject({
  /** What the blueprint makes, by the name the game gives it. */
  output_name: z.string().min(1),
  output_class: z.string().min(1).nullable(),
  figures: PatchFigures,
  /** What one craft takes, by ingredient name. */
  ingredients: z.record(z.string().min(1), PatchIngredient),
});
export type PatchBlueprint = z.infer<typeof PatchBlueprint>;

export const PatchSnapshot = z.strictObject({
  schema_version: z.literal(2),
  game_version: GameVersionString,
  channel: Channel,
  /** When the source says the build went out on its channel. */
  released_at: Timestamp.nullable(),
  fetched_at: Timestamp,
  /** The Star Citizen Wiki API until Phase 1, the patch-day pipeline after. */
  source: z.enum(["wiki-api", "pipeline"]),
  source_url: z.url(),
  counts: z.strictObject({
    ships: z.number().int().nonnegative(),
    parts: z.number().int().nonnegative(),
    blueprints: z.number().int().nonnegative(),
  }),
  ships: z.record(ClassName, PatchShip),
  /**
   * Vehicles the build lists whose figures the file does not hold (not on the ship matrix in
   * that build's record, or not served); a comparison neither adds nor removes them.
   */
  unrecorded_ships: z.array(ClassName),
  parts: z.record(ClassName, PatchPart),
  /** By the blueprint's key, for example `BP_CRAFT_AMRS_LaserCannon_S1`. */
  blueprints: z.record(z.string().min(1), PatchBlueprint),
});
export type PatchSnapshot = z.infer<typeof PatchSnapshot>;

/**
 * The file as written: the same snapshot with every figure path, port path, part class and
 * ingredient name stored once, in `dictionary`, and referred to by its place in it. A build's
 * records repeat the same few hundred paths thousands of times; written out each time they were
 * three quarters of the file (ADR-049).
 */
const Index = z.string().regex(/^\d+$/, "a dictionary index");
const IndexedFigures = z.record(Index, PatchValue);

export const PatchSnapshotFile = z.strictObject({
  schema_version: z.literal(2),
  game_version: GameVersionString,
  channel: Channel,
  released_at: Timestamp.nullable(),
  fetched_at: Timestamp,
  source: z.enum(["wiki-api", "pipeline"]),
  source_url: z.url(),
  counts: PatchSnapshot.shape.counts,
  dictionary: z.array(z.string().min(1)),
  unrecorded_ships: z.array(ClassName),
  ships: z.record(
    ClassName,
    z.strictObject({
      name: PatchShip.shape.name,
      game_name: PatchShip.shape.game_name,
      manufacturer: PatchShip.shape.manufacturer,
      figures: IndexedFigures,
      /** Port path index → part class index. */
      loadout: z.record(Index, z.number().int().nonnegative()),
    }),
  ),
  parts: z.record(
    ClassName,
    PatchPart.omit({ figures: true }).extend({ figures: IndexedFigures }),
  ),
  blueprints: z.record(
    z.string().min(1),
    PatchBlueprint.omit({ figures: true, ingredients: true }).extend({
      figures: IndexedFigures,
      ingredients: z.record(Index, PatchIngredient),
    }),
  ),
});
export type PatchSnapshotFile = z.infer<typeof PatchSnapshotFile>;

/** Writes a snapshot in the file's shape; the dictionary is sorted so a file reads predictably. */
export function encodeSnapshot(s: PatchSnapshot): PatchSnapshotFile {
  const words = new Set<string>();
  for (const ship of Object.values(s.ships)) {
    for (const k of Object.keys(ship.figures)) words.add(k);
    for (const [port, cls] of Object.entries(ship.loadout)) {
      words.add(port);
      words.add(cls);
    }
  }
  for (const part of Object.values(s.parts))
    for (const k of Object.keys(part.figures)) words.add(k);
  for (const bp of Object.values(s.blueprints)) {
    for (const k of Object.keys(bp.figures)) words.add(k);
    for (const k of Object.keys(bp.ingredients)) words.add(k);
  }
  const dictionary = [...words].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const at = new Map(dictionary.map((w, i) => [w, String(i)]));
  const idx = (w: string): string => at.get(w)!;
  const figures = (f: PatchFigures) =>
    Object.fromEntries(Object.entries(f).map(([k, v]) => [idx(k), v]));
  return {
    schema_version: 2,
    game_version: s.game_version,
    channel: s.channel,
    released_at: s.released_at,
    fetched_at: s.fetched_at,
    source: s.source,
    source_url: s.source_url,
    counts: s.counts,
    dictionary,
    unrecorded_ships: s.unrecorded_ships,
    ships: Object.fromEntries(
      Object.entries(s.ships).map(([id, ship]) => [
        id,
        {
          name: ship.name,
          game_name: ship.game_name,
          manufacturer: ship.manufacturer,
          figures: figures(ship.figures),
          loadout: Object.fromEntries(
            Object.entries(ship.loadout).map(([p, c]) => [
              idx(p),
              Number(idx(c)),
            ]),
          ),
        },
      ]),
    ),
    parts: Object.fromEntries(
      Object.entries(s.parts).map(([id, part]) => [
        id,
        { ...part, figures: figures(part.figures) },
      ]),
    ),
    blueprints: Object.fromEntries(
      Object.entries(s.blueprints).map(([id, bp]) => [
        id,
        {
          output_name: bp.output_name,
          output_class: bp.output_class,
          figures: figures(bp.figures),
          ingredients: Object.fromEntries(
            Object.entries(bp.ingredients).map(([k, v]) => [idx(k), v]),
          ),
        },
      ]),
    ),
  };
}

/** Reads a file back into a snapshot; an index outside the dictionary is a broken file and throws. */
export function decodeSnapshot(f: PatchSnapshotFile): PatchSnapshot {
  const word = (i: string | number): string => {
    const w = f.dictionary[Number(i)];
    if (w === undefined)
      throw new Error(
        `${f.game_version}: index ${i} is outside the dictionary`,
      );
    return w;
  };
  const figures = (x: Readonly<Record<string, PatchValue>>): PatchFigures =>
    Object.fromEntries(Object.entries(x).map(([k, v]) => [word(k), v]));
  return {
    schema_version: 2,
    game_version: f.game_version,
    channel: f.channel,
    released_at: f.released_at,
    fetched_at: f.fetched_at,
    source: f.source,
    source_url: f.source_url,
    counts: f.counts,
    unrecorded_ships: f.unrecorded_ships,
    ships: Object.fromEntries(
      Object.entries(f.ships).map(([id, ship]) => [
        id,
        {
          name: ship.name,
          game_name: ship.game_name,
          manufacturer: ship.manufacturer,
          figures: figures(ship.figures),
          loadout: Object.fromEntries(
            Object.entries(ship.loadout).map(([p, c]) => [word(p), word(c)]),
          ),
        },
      ]),
    ),
    parts: Object.fromEntries(
      Object.entries(f.parts).map(([id, part]) => [
        id,
        { ...part, figures: figures(part.figures) },
      ]),
    ),
    blueprints: Object.fromEntries(
      Object.entries(f.blueprints).map(([id, bp]) => [
        id,
        {
          output_name: bp.output_name,
          output_class: bp.output_class,
          figures: figures(bp.figures),
          ingredients: Object.fromEntries(
            Object.entries(bp.ingredients).map(([k, v]) => [word(k), v]),
          ),
        },
      ]),
    ),
  };
}
