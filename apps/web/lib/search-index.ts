import type { SearchEntry } from "ui";
import { repo } from "./data";
import { titleCatalog, titleSearchEntries } from "./titles";

/**
 * The palette's index (ADR-022): every entry (ships, named parts, makers, titles), served as one
 * static JSON document the palette fetches on first use instead of every page carrying it.
 */
export const SEARCH_INDEX_PATH = "/search-index.json";

export function searchIndex(): readonly SearchEntry[] {
  const r = repo();
  return [...r.searchEntries, ...titleSearchEntries(titleCatalog())];
}
