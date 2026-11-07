/**
 * Compare URL state (spec 02, "Compare"): `/compare?ships=a,b,c,d` holds up to four ship slugs.
 * Pure helpers shared by the page, the add/remove links and the client-side basket, so the URL is
 * the one contract.
 */

export const MAX_COMPARE = 4;

export interface CompareSelection {
  /** Unique slugs in the order given, at most MAX_COMPARE. */
  readonly slugs: readonly string[];
  /** Slugs beyond the cap, dropped in order. */
  readonly dropped: readonly string[];
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Reads `ships` from a query (or a raw comma-separated string): split, trim, dedupe, cap. */
export function parseCompare(
  value: string | string[] | undefined,
): CompareSelection {
  const raw = first(value) ?? "";
  const seen = new Set<string>();
  const slugs: string[] = [];
  const dropped: string[] = [];
  for (const part of raw.split(",")) {
    const slug = part.trim().toLowerCase();
    if (slug === "" || seen.has(slug)) continue;
    seen.add(slug);
    if (slugs.length < MAX_COMPARE) slugs.push(slug);
    else dropped.push(slug);
  }
  return { slugs, dropped };
}

export function compareHref(slugs: readonly string[]): string {
  return slugs.length === 0
    ? "/compare"
    : `/compare?ships=${slugs.map(encodeURIComponent).join(",")}`;
}

/** The selection with `slug` appended, unchanged when present or full. */
export function withShip(
  slugs: readonly string[],
  slug: string,
): readonly string[] {
  if (slugs.includes(slug) || slugs.length >= MAX_COMPARE) return slugs;
  return [...slugs, slug];
}

export function withoutShip(
  slugs: readonly string[],
  slug: string,
): readonly string[] {
  return slugs.filter((s) => s !== slug);
}

export function toggleShip(
  slugs: readonly string[],
  slug: string,
): readonly string[] {
  return slugs.includes(slug)
    ? withoutShip(slugs, slug)
    : withShip(slugs, slug);
}
