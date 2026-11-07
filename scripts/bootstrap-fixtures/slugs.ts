import { Slug } from "schema";
import { MapError } from "./errors.js";

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface Named {
  readonly class_name: string;
  readonly name: string;
  readonly manufacturer_code: string;
}

function counts(values: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

/**
 * Slug per class_name (data-model: Slugs and redirects): the kebab-case display name; prefixed with
 * the manufacturer code when two names collide; the kebab-case class_name itself when the prefixed
 * slug still collides, which happens when placeholder components share one display name within a
 * manufacturer. class_name is unique by definition, so the third step resolves every real case;
 * anything still colliding halts.
 */
export function assignSlugs(rows: readonly Named[]): Map<string, string> {
  const bases = rows.map((row) => slugify(row.name));
  const baseCounts = counts(bases);
  const prefixed = rows.map((row, i) => {
    const base = bases[i] ?? "";
    return (baseCounts.get(base) ?? 0) > 1
      ? `${slugify(row.manufacturer_code)}-${base}`
      : base;
  });
  const prefixedCounts = counts(prefixed);

  const taken = new Map<string, string>();
  const result = new Map<string, string>();
  rows.forEach((row, i) => {
    const candidate = prefixed[i] ?? "";
    const slug =
      (prefixedCounts.get(candidate) ?? 0) > 1
        ? slugify(row.class_name)
        : candidate;
    if (!Slug.safeParse(slug).success) {
      throw new MapError(
        `cannot derive a slug for ${row.class_name} from the name ${JSON.stringify(row.name)}`,
        { class_name: row.class_name, name: row.name },
      );
    }
    const owner = taken.get(slug);
    if (owner !== undefined) {
      throw new MapError(
        `slug ${slug} is shared by ${owner} and ${row.class_name} even after the manufacturer prefix and the class_name fallback`,
        { slug, class_names: [owner, row.class_name] },
      );
    }
    taken.set(slug, row.class_name);
    result.set(row.class_name, slug);
  });
  return result;
}
