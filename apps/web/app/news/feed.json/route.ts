import { repo } from "../../../lib/data";
import { siteUrl } from "../../../lib/seo";

/** The feed as JSON Feed 1.1 (spec 03, "Feed UI"): the latest fifty items, each linking its original. */
export const dynamic = "force-static";

export function GET(): Response {
  const base = siteUrl().origin;
  const items = repo()
    .news.slice(0, 50)
    .map((n) => ({
      id: n.id,
      url: n.url,
      title: n.title,
      content_html: n.body_html,
      summary: n.summary ?? undefined,
      date_published: n.published_at,
      tags: [n.source],
    }));
  return Response.json(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: "SC Hub news",
      home_page_url: `${base}/news`,
      feed_url: `${base}/news/feed.json`,
      description:
        "Comm-Links and roadmap changes, each linked to its original on the source site. An unofficial fan site, not affiliated with Cloud Imperium.",
      items,
    },
    {
      headers: {
        "Content-Type": "application/feed+json; charset=utf-8",
        "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
      },
    },
  );
}
