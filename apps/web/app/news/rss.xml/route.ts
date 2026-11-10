import { repo } from "../../../lib/data";
import { siteUrl } from "../../../lib/seo";

/** The feed as RSS 2.0 (spec 03, "Feed UI"): the latest fifty items, each linking its original. */
export const dynamic = "force-static";

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function GET(): Response {
  const base = siteUrl().origin;
  // The dispatches (ADR-029): what CIG publishes; developer posts are not syndicated here.
  const items = repo()
    .dispatches.slice(0, 50)
    .map(
      (n) => `    <item>
      <title>${escape(n.title)}</title>
      <link>${escape(n.url)}</link>
      <guid isPermaLink="false">${escape(n.id)}</guid>
      <pubDate>${new Date(n.published_at).toUTCString()}</pubDate>
      <category>${escape(n.source)}</category>${
        n.summary === null
          ? ""
          : `\n      <description>${escape(n.summary)}</description>`
      }
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SC Hub news</title>
    <link>${escape(`${base}/news`)}</link>
    <atom:link href="${escape(`${base}/news/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>Comm-Links and roadmap changes, each linked to its original on the source site. Comm-Link text via the Star Citizen Wiki API (api.star-citizen.wiki). An unofficial fan site, not affiliated with Cloud Imperium.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    },
  });
}
