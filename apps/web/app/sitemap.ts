import type { MetadataRoute } from "next";
import { repo } from "../lib/data";
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
  return [
    entry("/", 1),
    entry("/ships", 0.9, lastModified),
    entry("/components", 0.8, lastModified),
    entry("/news", 0.8),
    entry("/news/dev", 0.6),
    entry("/about", 0.3),
    entry("/privacy", 0.2),
    entry("/licenses", 0.1),
    ...r.ships.map((s) => entry(`/ships/${s.vehicle.slug}`, 0.8, lastModified)),
    ...r.manufacturers.map((m) => entry(`/manufacturers/${m.slug}`, 0.6)),
    ...r.components.map((c) =>
      entry(`/components/${c.item.slug}`, 0.5, lastModified),
    ),
  ];
}
