import type { SearchEntry } from "ui";
import { repo } from "./data";
import { currentPtu } from "./patch-page";
import { builds, latestLive, previousOf } from "./patches";
import { titleCatalog, titleSearchEntries } from "./titles";

/**
 * The palette's index (ADR-022): every entry (ships, named parts, makers, titles), served as one
 * static JSON document the palette fetches on first use instead of every page carrying it.
 */
export const SEARCH_INDEX_PATH = "/search-index.json";

export function searchIndex(): readonly SearchEntry[] {
  const r = repo();
  return [
    ...r.searchEntries,
    ...patchSearchEntries(),
    ...titleSearchEntries(titleCatalog()),
  ];
}

const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Each patch page (ADR-049), by version, and the PTU's while one is in testing. */
export function patchSearchEntries(): SearchEntry[] {
  const list = builds();
  const newest = latestLive(list);
  const live = list
    .filter((b) => b.channel === "LIVE" && previousOf(b, list) !== null)
    .reverse()
    .map((b) => ({
      type: "patch" as const,
      name: `What changed in ${b.version}`,
      href: b.code === newest?.code ? "/patches" : `/patches/${b.slug}`,
      meta: `LIVE ${b.code}${b.releasedAt === null ? "" : `, ${day.format(new Date(b.releasedAt))}`}`,
    }));
  const ptu = currentPtu();
  return ptu === null
    ? live
    : [
        {
          type: "patch" as const,
          name: `On the PTU: ${ptu.version}`,
          href: "/patches/ptu",
          meta: "PTU patch notes",
        },
        ...live,
      ];
}
