import { notFound, permanentRedirect } from "next/navigation";
import { type Sluggable, resolveSlug } from "./slugs";

/**
 * The entity an entity route shows for a slug (spec 02, "Slugs and redirects"): an old slug from
 * slug_history answers with Next's permanent redirect (308) to the current path, an unknown slug
 * with the 404 page and its search box. Both Next functions throw, so the caller only ever sees
 * the current entity.
 */
export function entityForSlug<T extends Sluggable>(
  rows: readonly T[],
  slug: string,
  basePath: string,
): T {
  const result = resolveSlug(rows, slug);
  if (result.status === "moved") permanentRedirect(`${basePath}/${result.to}`);
  if (result.status === "missing") notFound();
  return result.entity;
}
