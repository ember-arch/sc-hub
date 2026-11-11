/**
 * Client-side matching for the Phase 0 command palette. Pure, so it is unit-tested on its own;
 * Meilisearch replaces it in spec 02 and the palette keeps its keyboard model.
 */

export type SearchEntryType =
  "ship" | "component" | "manufacturer" | "patch" | "title";

export interface SearchEntry {
  readonly type: SearchEntryType;
  readonly name: string;
  readonly href: string;
  /** Secondary text, searched too: manufacturer, role, item type. */
  readonly meta?: string | undefined;
}

export const SEARCH_GROUPS: readonly {
  type: SearchEntryType;
  title: string;
}[] = [
  { type: "ship", title: "Ships" },
  { type: "component", title: "Components" },
  { type: "manufacturer", title: "Manufacturers" },
  { type: "patch", title: "Patches" },
  { type: "title", title: "Titles" },
];

export const PER_GROUP = 6;

/** Name prefix first, then name substring, then meta substring; at most PER_GROUP per type. */
export function matchEntries(
  entries: readonly SearchEntry[],
  query: string,
): readonly SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const scored = entries
    .map((entry) => {
      const name = entry.name.toLowerCase();
      const meta = (entry.meta ?? "").toLowerCase();
      const score = name.startsWith(q)
        ? 0
        : name.includes(q)
          ? 1
          : meta.includes(q)
            ? 2
            : -1;
      return { entry, score };
    })
    .filter((s) => s.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score || a.entry.name.localeCompare(b.entry.name, "en"),
    );
  const out: SearchEntry[] = [];
  for (const group of SEARCH_GROUPS) {
    out.push(
      ...scored
        .filter((s) => s.entry.type === group.type)
        .slice(0, PER_GROUP)
        .map((s) => s.entry),
    );
  }
  return out;
}
