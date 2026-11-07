import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Author, ContentItem } from "schema";
import type { StorySample } from "ui/stories";
import { REPO_ROOT, repo } from "./data";

/**
 * Rows for the component gallery (ADR-005): real pack rows for everything the pack has, and the
 * synthetic schema fixtures for the dev post and its author, which no source provides in Phase 0.
 */
export function storySample(): StorySample {
  const r = repo();
  const ship = r.ships.find((s) => s.vehicle.slug === "gladius") ?? r.ships[0];
  if (ship === undefined || ship.stats === null || ship.manufacturer === null) {
    throw new Error(
      "the gallery needs one ship with stats and a manufacturer in the pack",
    );
  }
  const items = r.components
    .filter(
      (c) =>
        c.item.manufacturer_code !== "UNKN" &&
        !c.item.name.includes("PLACEHOLDER"),
    )
    .slice(0, 8);
  const fixture = (entity: string): unknown =>
    JSON.parse(
      readFileSync(
        join(REPO_ROOT, "fixtures", "schema", `${entity}.json`),
        "utf8",
      ),
    );
  const author = Author.parse(fixture("Author"));
  const devPost = ContentItem.parse(fixture("ContentItem"));
  return {
    vehicle: ship.vehicle,
    stats: ship.stats,
    manufacturer: ship.manufacturer,
    items: items.map((c) => c.item),
    itemStats: items
      .map((c) => c.stats)
      .filter((s): s is NonNullable<typeof s> => s !== null),
    versions: r.gameVersions,
    news: r.news,
    author,
    devPost,
    // A fixed "now" keeps relative times identical between runs and screenshots.
    now: "2026-11-07T12:00:00.000Z",
  };
}
