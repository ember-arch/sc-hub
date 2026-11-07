/**
 * Slugs and redirects (spec 02; docs/data-model.md "Slugs and redirects"): a slug is computed
 * once and never changes; on a rename the old slug joins `slug_history` and the app redirects
 * it to the current one. Pure, so it is unit-tested over a synthetic row (the bootstrap pack has
 * empty histories).
 */

export interface Sluggable {
  readonly slug: string;
  readonly slug_history: readonly string[];
}

export type SlugResolution<T> =
  | { readonly status: "current"; readonly entity: T }
  | { readonly status: "moved"; readonly entity: T; readonly to: string }
  | { readonly status: "missing" };

/** The current entity for `slug`, the entity it moved to, or nothing. Current slugs win over histories. */
export function resolveSlug<T extends Sluggable>(
  rows: readonly T[],
  slug: string,
): SlugResolution<T> {
  const current = rows.find((row) => row.slug === slug);
  if (current !== undefined) return { status: "current", entity: current };
  const moved = rows.find((row) => row.slug_history.includes(slug));
  if (moved !== undefined) {
    return { status: "moved", entity: moved, to: moved.slug };
  }
  return { status: "missing" };
}
