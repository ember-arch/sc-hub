import type { MetadataRoute } from "next";
import { repo } from "../lib/data";
import { events } from "../lib/events";
import { builds, latestLive, previousOf } from "../lib/patches";
import { absolute } from "../lib/seo";

/**
 * sitemap.xml (spec 02, "SEO"): every indexable route. Compare pages and the gallery are
 * noindex and stay out. Entity pages carry the LIVE build's publish time as lastModified, since
 * their numbers change only when a new version is imported.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const r = repo();
  const live = r.gameVersions.find((v) => v.channel === "LIVE" && v.is_current);
  const lastModified =
    live?.published_at == null ? undefined : new Date(live.published_at);
  const entry = (
    path: string,
    priority: number,
    modified?: Date,
  ): MetadataRoute.Sitemap[number] => ({
    url: absolute(path),
    priority,
    ...(modified === undefined ? {} : { lastModified: modified }),
  });
  // The patch pages (ADR-049): the latest patch is /patches, each earlier one its own address.
  const patchBuilds = builds();
  const newest = latestLive(patchBuilds);
  const patches = patchBuilds.filter(
    (b) =>
      b.channel === "LIVE" &&
      b.code !== newest?.code &&
      previousOf(b, patchBuilds) !== null,
  );
  const released = (at: string | null) =>
    at === null ? undefined : new Date(at);
  return [
    entry("/", 1),
    entry("/patches", 0.8, released(newest?.releasedAt ?? null)),
    entry("/patches/ptu", 0.6),
    ...patches.map((b) =>
      entry(`/patches/${b.slug}`, 0.5, released(b.releasedAt)),
    ),
    entry("/ships", 0.9, lastModified),
    entry("/components", 0.8, lastModified),
    entry("/news", 0.8),
    entry("/news/dev", 0.6),
    entry("/news/videos", 0.6),
    entry("/titles", 0.6),
    // The shows (ADR-057): each event page, changed when the events step last read RSI.
    entry("/events", 0.5),
    ...events().map((e) =>
      entry(`/events/${e.slug}`, 0.7, new Date(e.fetched_at)),
    ),
    entry("/about", 0.3),
    entry("/privacy", 0.2),
    entry("/licenses", 0.1),
    ...r.entries.map((s) =>
      entry(`/ships/${s.vehicle.slug}`, 0.8, lastModified),
    ),
    ...r.manufacturers.map((m) => entry(`/manufacturers/${m.slug}`, 0.6)),
    ...r.components.map((c) =>
      entry(`/components/${c.item.slug}`, 0.5, lastModified),
    ),
  ];
}
