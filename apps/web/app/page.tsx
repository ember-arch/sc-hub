import type { Metadata } from "next";
import {
  Card,
  EmptyState,
  FeedItem,
  PatchStrip,
  SearchField,
  Section,
  TextLink,
  sentence,
} from "ui";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { repo } from "../lib/data";
import { Site, now } from "../lib/site";
import { shipCard } from "../lib/views";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_TAGLINE,
  alternates: { canonical: "/" },
};

/** Home: search first, then today's feed, one featured ship card, the patch strip. No hero banner. */
export default function HomePage() {
  const r = repo();
  const feed = r.news.slice(0, 10);
  const featured = r.ships[0];
  const at = now();
  return (
    <Site>
      <div className="flex flex-col gap-12 pt-8">
        <div className="flex flex-col gap-3">
          {/* The header already names the site; the h1 is for assistive tech and outlines. */}
          <h1 className="sr-only">{SITE_NAME}</h1>
          <SearchField />
        </div>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Section id="feed" title="Today">
              {feed.length === 0 ? (
                <EmptyState>
                  No news yet. Comm-Links and developer posts will appear here;
                  until then, browse the{" "}
                  <TextLink href="/ships">ships</TextLink>.
                </EmptyState>
              ) : (
                <div className="flex flex-col">
                  {feed.map((item) => (
                    <FeedItem
                      key={item.id}
                      source={sentence(item.source)}
                      title={item.title}
                      sourceUrl={item.url}
                      publishedAt={item.published_at}
                      now={at}
                      excerpt={item.summary}
                      entities={[]}
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>
          <div className="flex flex-col gap-12">
            {featured !== undefined ? (
              <Section id="featured" title="Featured ship">
                <Card {...shipCard(featured)} />
              </Section>
            ) : null}
            <Section id="versions" title="Current builds">
              <PatchStrip versions={r.versions} />
            </Section>
          </div>
        </div>
      </div>
    </Site>
  );
}
