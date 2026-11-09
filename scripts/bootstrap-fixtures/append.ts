/**
 * Append-only regeneration of the bootstrap pack (ADR-016; CLAUDE.md section 2, "Never mutate a
 * published data version", and section 5, slugs never change after first publish). When the pack
 * on disk is for the same build, every row it already has is kept byte for byte (the API's later
 * edits, such as a new `updated_at`, do not rewrite it), new rows are added after them, and every
 * slug it already published stays with its class name. A part new to the pack cannot take a slug
 * an existing part holds. Pure; unit-tested.
 */

/** The identity of a row in each pack entity. */
export const ROW_KEYS = {
  GameVersion: (r: Row) => `${r["channel"]}|${r["version"]}`,
  Manufacturer: (r: Row) => String(r["code"]),
  Vehicle: (r: Row) => String(r["class_name"]),
  VehicleStats: (r: Row) =>
    `${r["class_name"]}|${r["channel"]}|${r["game_version"]}`,
  Port: (r: Row) =>
    `${r["class_name"]}|${r["channel"]}|${r["game_version"]}|${r["port_path"]}`,
  Item: (r: Row) => String(r["class_name"]),
  ItemStats: (r: Row) =>
    `${r["class_name"]}|${r["channel"]}|${r["game_version"]}`,
} as const;

export type Entity = keyof typeof ROW_KEYS;
type Row = Readonly<Record<string, unknown>>;

/** The previous rows first, unchanged, then the new rows the previous pack did not have. */
export function appendRows<T extends Row>(
  entity: Entity,
  previous: readonly T[],
  next: readonly T[],
): T[] {
  const key = ROW_KEYS[entity];
  const have = new Set(previous.map(key));
  return [...previous, ...next.filter((row) => !have.has(key(row)))];
}

/**
 * Slugs for new rows that collide with none already published: a published class name keeps its
 * slug; a new one keeps the slug it was given unless an existing row holds it, in which case it
 * takes its manufacturer-prefixed slug, then its kebab-case class name.
 */
export function pinSlugs(
  assigned: ReadonlyMap<string, string>,
  published: ReadonlyMap<string, string>,
  fallbacks: (className: string) => readonly string[],
): Map<string, string> {
  const taken = new Map<string, string>();
  for (const [cls, slug] of published) taken.set(slug, cls);
  const out = new Map<string, string>();
  for (const [cls, slug] of assigned) {
    const kept = published.get(cls);
    if (kept !== undefined) {
      out.set(cls, kept);
      continue;
    }
    const choice = [slug, ...fallbacks(cls)].find((s) => {
      const owner = taken.get(s);
      return owner === undefined || owner === cls;
    });
    if (choice === undefined) {
      throw new Error(
        `no free slug for ${cls}; tried ${[slug, ...fallbacks(cls)].join(", ")}`,
      );
    }
    taken.set(choice, cls);
    out.set(cls, choice);
  }
  return out;
}
