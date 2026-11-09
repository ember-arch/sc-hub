/**
 * An edition is a vehicle that points at a base (`base_variant_of`) and carries the base's own
 * display name and maker: a showroom copy or a sale edition of the same ship (ADR-022). The site
 * lists an edition under its base, not as an entry of its own; its page stays, reached from the
 * base's entry. A variant with a name of its own (a Gladius Valiant under a Gladius) is an entry.
 * Shared with the end-to-end tests, which read the pack the same way.
 */
export interface EditionCandidate {
  readonly class_name: string;
  readonly name: string;
  readonly manufacturer_code: string;
  readonly base_variant_of: string | null;
}

/** The base an edition stands under, or null for an entry of its own. */
export function editionBase<T extends EditionCandidate>(
  vehicle: T,
  byClass: ReadonlyMap<string, T>,
): T | null {
  if (vehicle.base_variant_of === null) return null;
  const base = byClass.get(vehicle.base_variant_of);
  if (base === undefined || base.class_name === vehicle.class_name) return null;
  return base.name === vehicle.name &&
    base.manufacturer_code === vehicle.manufacturer_code
    ? base
    : null;
}

/**
 * The wiki keeps CIG's placeholder where the game files give a part no name ("<= PLACEHOLDER =>":
 * most thrusters, intakes, armour and tanks). The site shows such a part under its class name,
 * the one identifier it has, and leaves it out of search; the fixture keeps the API's own value.
 */
export const isPlaceholderName = (name: string): boolean =>
  /^<=.*=>$/.test(name.trim());

/** The vehicles listed as entries: every one that is not an edition of another. */
export function listedVehicles<T extends EditionCandidate>(
  vehicles: readonly T[],
): T[] {
  const byClass = new Map(vehicles.map((v) => [v.class_name, v]));
  return vehicles.filter((v) => editionBase(v, byClass) === null);
}
