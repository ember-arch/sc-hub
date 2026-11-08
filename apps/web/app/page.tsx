import type { Metadata } from "next";
import {
  Card,
  EmptyState,
  FeedItem,
  SearchField,
  Section,
  TextLink,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { repo } from "../lib/data";
import { Site, now } from "../lib/site";
import { shipCard } from "../lib/views";
import { shipCardImage } from "../lib/media";
import { conceptShips, showcaseFor } from "../lib/showcase";
import { ConceptSpotlight, LiveSpotlight } from "./spotlight";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_TAGLINE,
  alternates: { canonical: "/" },
};

/** The owner's showcase pair (2026-11-08): the concept hero and the live example. */
const CONCEPT_HERO = "odin";
const LIVE_EXAMPLE = "perseus";

/**
 * Home (ADR-010): the concept hero full-bleed in its key art, the live example as a feature, then
 * search, today's feed and every ship on record. Without media the spotlights drop away and the
 * page is search, feed and ships, as before.
 */
export default function HomePage() {
  const r = repo();
  const feed = r.news.slice(0, 10);
  const at = now();
  const concept = conceptShips().find((c) => c.slug === CONCEPT_HERO);
  const conceptShow =
    concept === undefined ? null : showcaseFor(concept.slug, concept.name);
  const conceptMaker =
    concept === undefined
      ? undefined
      : r.manufacturers.find((m) => m.code === concept.manufacturer_code);
  const live = r.shipBySlug(LIVE_EXAMPLE);
  const liveShow =
    live === undefined
      ? null
      : showcaseFor(live.vehicle.slug, live.vehicle.name);
  const liveImage = liveShow?.poster ?? liveShow?.background ?? null;

  return (
    <Site
      theme="dark"
      stage={
        concept === undefined || conceptShow?.background == null ? undefined : (
          <>
            <ConceptSpotlight
              name={concept.name}
              href={`/ships/${concept.slug}`}
              kicker={`${conceptMaker?.name ?? concept.manufacturer_code} · ${concept.focus ?? ""}`}
              tagline={conceptShow.intro?.heading ?? null}
              lead={conceptShow.intro?.text[0] ?? concept.description}
              background={conceptShow.background}
              cutout={conceptShow.cutout}
            />
            {live === undefined || liveImage === null ? null : (
              <LiveSpotlight
                name={live.vehicle.name}
                href={`/ships/${live.vehicle.slug}`}
                kicker={`${live.manufacturer?.name ?? live.vehicle.manufacturer_code} · ${live.vehicle.role ?? ""}`}
                status={vehicleStatusBadge(live.vehicle.status)}
                tagline={liveShow?.intro?.heading ?? null}
                lead={
                  liveShow?.intro?.text[0] ?? live.description?.text ?? null
                }
                image={liveImage}
              />
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-12 pt-12">
        <div className="flex flex-col gap-3">
          {/* The header already names the site; the h1 is for assistive tech and outlines. */}
          <h1 className="sr-only">{SITE_NAME}</h1>
          <SearchField />
        </div>
        <Section
          id="ships"
          title="Ships on record"
          aside={`${r.ships.length} ships`}
        >
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
            {r.ships.map((ship) => (
              <li key={ship.vehicle.class_name}>
                <Card {...shipCard(ship, shipCardImage(ship))} />
              </li>
            ))}
          </ul>
        </Section>
        <Section id="feed" title="Today">
          {feed.length === 0 ? (
            <EmptyState>
              No news yet. Comm-Links and developer posts will appear here;
              until then, browse the <TextLink href="/ships">ships</TextLink>.
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
    </Site>
  );
}
