/**
 * A concept ship that joins the pack keeps its page's address. Its concept page
 * (fixtures/ship-matrix/ConceptShip.json, ADR-022) published the slug, and slugs never change after
 * first publish (CLAUDE.md section 5). When a build gains vehicles of that maker and name (4.10.3
 * brought the Galaxy, with two module placeholders of the same name, and the Liberator), the base
 * one, the shortest class name, since editions extend it (editions.ts), takes the concept's slug.
 * A class that already has a published slug keeps it, and a slug another class holds is left to
 * that class.
 */
import { sameName } from "../media/sources.js";

export interface ConceptRow {
  readonly slug: string;
  readonly name: string;
  readonly manufacturer_code: string;
}

export interface NamedVehicle {
  readonly class_name: string;
  readonly name: string;
  readonly manufacturer_code: string;
}

/** The concept slugs the pack's vehicles take: class name to slug. */
export function conceptSlugs(
  concepts: readonly ConceptRow[],
  vehicles: readonly NamedVehicle[],
  published: ReadonlyMap<string, string>,
): Map<string, string> {
  const held = new Set(published.values());
  const out = new Map<string, string>();
  for (const concept of concepts) {
    if (held.has(concept.slug)) continue;
    const base = vehicles
      .filter(
        (v) =>
          v.manufacturer_code === concept.manufacturer_code &&
          sameName(v.name, concept.name),
      )
      .sort(
        (a, b) =>
          a.class_name.length - b.class_name.length ||
          a.class_name.localeCompare(b.class_name),
      )[0];
    if (
      base === undefined ||
      published.has(base.class_name) ||
      out.has(base.class_name)
    )
      continue;
    out.set(base.class_name, concept.slug);
    held.add(concept.slug);
  }
  return out;
}
