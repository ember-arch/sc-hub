import type { Metadata } from "next";
import {
  EmptyState,
  FeedItem,
  SearchField,
  Section,
  TextLink,
  formatNumber,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { pricesFor } from "../lib/acquisition";
import { repo } from "../lib/data";
import { shipCardImage } from "../lib/media";
import { conceptShips, showcaseFor } from "../lib/showcase";
import { Site, now } from "../lib/site";
import { crewRange } from "../lib/views";
import { FeaturedFile, Register, type RegisterRow } from "./home-index";
import { PriceCredit } from "./price-credit";
import { FileStrip } from "./ships/[slug]/showcase/dossier";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_TAGLINE,
  alternates: { canonical: "/" },
};

/** The register's pledge column (ADR-013): the headline price and whether it is on sale. */
function pledgeCell(
  slug: string,
  className: string | null,
): RegisterRow["pledge"] {
  const pledge = pricesFor(slug, className).pledge;
  return pledge === null
    ? null
    : { price: formatNumber(pledge.price_usd), onSale: pledge.available };
}

/** The owner's showcase pair (2026-11-08): the concept hero and the live example. */
const CONCEPT_HERO = "odin";
const LIVE_EXAMPLE = "perseus";

const fileNumber = (code: string, slug: string): string =>
  `${code}-${slug.toUpperCase()}`;

/**
 * Home as the dossier index (ADR-011): a file strip, the featured files for the concept hero and
 * the live example, the register of every ship on record, and today's feed. Without media the
 * featured files show their particulars without art.
 */
export default function HomePage() {
  const r = repo();
  const feed = r.news.slice(0, 10);
  const at = now();
  const concepts = conceptShips();
  const concept = concepts.find((c) => c.slug === CONCEPT_HERO);
  const conceptShow =
    concept === undefined ? null : showcaseFor(concept.slug, concept.name);
  const makerName = (code: string): string =>
    r.manufacturers.find((m) => m.code === code)?.name ?? code;
  const live = r.shipBySlug(LIVE_EXAMPLE);
  const liveShow =
    live === undefined
      ? null
      : showcaseFor(live.vehicle.slug, live.vehicle.name);

  const rows: RegisterRow[] = [
    ...concepts.map((c) => {
      const poster = showcaseFor(c.slug, c.name)?.poster ?? null;
      return {
        file: fileNumber(c.manufacturer_code, c.slug),
        name: c.name,
        href: `/ships/${c.slug}`,
        maker: makerName(c.manufacturer_code),
        role: c.focus,
        status: vehicleStatusBadge("concept"),
        length: c.length_m === null ? null : formatNumber(c.length_m),
        crew:
          c.crew_min === null || c.crew_max === null
            ? null
            : crewRange(c.crew_min, c.crew_max),
        pledge: pledgeCell(c.slug, null),
        thumb: poster,
      };
    }),
    ...r.ships.map((ship) => {
      const image = shipCardImage(ship);
      return {
        file: fileNumber(ship.vehicle.manufacturer_code, ship.vehicle.slug),
        name: ship.vehicle.name,
        href: `/ships/${ship.vehicle.slug}`,
        maker: ship.manufacturer?.name ?? ship.vehicle.manufacturer_code,
        role: ship.vehicle.role,
        status: vehicleStatusBadge(ship.vehicle.status),
        length:
          ship.stats === null ? null : formatNumber(ship.stats.length_m, 2),
        crew:
          ship.stats === null
            ? null
            : crewRange(ship.stats.crew_min, ship.stats.crew_max),
        pledge: pledgeCell(ship.vehicle.slug, ship.vehicle.class_name),
        thumb: image === null ? null : { src: image.src, srcSet: image.srcSet },
      };
    }),
  ];

  return (
    <Site theme="dark">
      <div className="flex flex-col gap-12 pt-8">
        <FileStrip
          document="Dossier index"
          meta={[
            { label: "Files", value: String(rows.length) },
            { label: "In concept", value: String(concepts.length) },
            // The current build stays in the footer's patch strip only (ADR-007: one per page).
            { label: "Updated", value: at.toISOString().slice(0, 10) },
          ]}
        />
        <div className="flex flex-col gap-4">
          <h1 className="m-0 text-display text-primary md:text-hero">
            Ship dossiers
          </h1>
          <p className="m-0 max-w-prose text-heading font-regular text-secondary">
            Every ship on record as a file: CIG&apos;s art and words, the
            game&apos;s data by build, and where each piece came from.
          </p>
          <div className="pt-2">
            <SearchField />
          </div>
        </div>

        {concept === undefined && live === undefined ? null : (
          <section aria-labelledby="featured" className="flex flex-col gap-4">
            <h2
              id="featured"
              className="m-0 border-t border-hairline-strong pt-4 text-title text-primary"
            >
              Featured files
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {concept === undefined ? null : (
                <FeaturedFile
                  file={fileNumber(concept.manufacturer_code, concept.slug)}
                  name={concept.name}
                  href={`/ships/${concept.slug}`}
                  kicker={`${makerName(concept.manufacturer_code)} · ${concept.focus ?? ""} · concept hero`}
                  status={vehicleStatusBadge("concept")}
                  tagline={conceptShow?.intro?.heading ?? null}
                  background={conceptShow?.background ?? null}
                  cutout={conceptShow?.cutout ?? null}
                  facts={[
                    ...(concept.length_m === null
                      ? []
                      : [
                          {
                            label: "Length",
                            value: formatNumber(concept.length_m),
                            unit: "m",
                          },
                        ]),
                    ...(concept.crew_min === null || concept.crew_max === null
                      ? []
                      : [
                          {
                            label: "Crew",
                            value: crewRange(
                              concept.crew_min,
                              concept.crew_max,
                            ),
                          },
                        ]),
                    ...(concept.cargo_scu === null
                      ? []
                      : [
                          {
                            label: "Cargo",
                            value: formatNumber(concept.cargo_scu),
                            unit: "SCU",
                          },
                        ]),
                  ]}
                  priority
                />
              )}
              {live === undefined ? null : (
                <FeaturedFile
                  file={fileNumber(
                    live.vehicle.manufacturer_code,
                    live.vehicle.slug,
                  )}
                  name={live.vehicle.name}
                  href={`/ships/${live.vehicle.slug}`}
                  kicker={`${live.manufacturer?.name ?? live.vehicle.manufacturer_code} · ${live.vehicle.role ?? ""} · live example`}
                  status={vehicleStatusBadge(live.vehicle.status)}
                  tagline={liveShow?.intro?.heading ?? null}
                  background={liveShow?.background ?? null}
                  cutout={liveShow?.cutout ?? null}
                  facts={
                    live.stats === null
                      ? []
                      : [
                          {
                            label: "Length",
                            value: formatNumber(live.stats.length_m, 2),
                            unit: "m",
                          },
                          {
                            label: "Crew",
                            value: crewRange(
                              live.stats.crew_min,
                              live.stats.crew_max,
                            ),
                          },
                          ...(live.stats.cargo_scu === null
                            ? []
                            : [
                                {
                                  label: "Cargo",
                                  value: formatNumber(live.stats.cargo_scu),
                                  unit: "SCU",
                                },
                              ]),
                        ]
                  }
                  priority
                />
              )}
            </div>
          </section>
        )}

        <section aria-labelledby="register" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline-strong pt-4">
            <h2 id="register" className="m-0 text-title text-primary">
              Register
            </h2>
            <span className="text-caption text-secondary">
              {rows.length} files ·{" "}
              <TextLink href="/ships" className="text-secondary">
                Filter and compare
              </TextLink>
            </span>
          </div>
          <Register rows={rows} />
          <PriceCredit inGame={false} />
        </section>

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
