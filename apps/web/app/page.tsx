import type { Metadata } from "next";
import {
  Card,
  type CardProps,
  EmptyState,
  FeedItem,
  type ResponsiveImage,
  TextLink,
  sentence,
} from "ui";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { RSI_IMAGE_CREDIT } from "ui/legal";
import { pricesFor } from "../lib/acquisition";
import { repo } from "../lib/data";
import { formatFrontDate, pickPlates, signed } from "../lib/front";
import {
  formatChange,
  formatCompact,
  formatDay,
  formatValue,
  funding,
  headline,
  type Reading,
  readings,
} from "../lib/funding";
import { media, shipCardImage } from "../lib/media";
import { conceptShips, showcaseFor } from "../lib/showcase";
import { Site, now } from "../lib/site";
import { crewRange, shipCard } from "../lib/views";
import {
  Contents,
  type Counter,
  Counters,
  Bento,
  type PlateEntry,
  RunningHead,
} from "./front";
import { PriceCredit } from "./price-credit";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_TAGLINE,
  alternates: { canonical: "/" },
};

/** A concept ship's poster as a card image, credited to its RSI page (ADR-009, ADR-010). */
function conceptImage(
  slug: string,
  name: string,
  pageUrl: string,
): ResponsiveImage | null {
  const poster = showcaseFor(slug, name)?.poster ?? null;
  if (poster === null) return media().concept(slug, null);
  return {
    ...poster,
    alt: "",
    credit: { text: RSI_IMAGE_CREDIT.text, href: pageUrl },
  };
}

/** How many entry cards the front shows; two rows of five on a wide screen. */
const FRONT_ENTRIES = 10;

/** The year of the first reading, for the counter's label. */
const firstYear = (list: readonly Reading[] | null): string =>
  list?.[0]?.day.slice(0, 4) ?? "the start";

/** The owner's showcase pair (ADR-010): the concept hero and the live example. */
const CONCEPT_HERO = "odin";
const LIVE_EXAMPLE = "perseus";

/**
 * The front page of the almanac (ADR-020, spec 06): the date and build line, the title and the
 * contents, the counters, the plates, the entries A to Z, then the dispatches. Without media the
 * plates hold their captions alone and the entry cards their particulars.
 */
export default function HomePage() {
  const r = repo();
  const at = now();
  const concepts = conceptShips();
  const makerName = (code: string): string =>
    r.manufacturers.find((m) => m.code === code)?.name ?? code;

  // Counters. The funding ones need the fixture; the record counts are always there.
  const series = funding();
  const pledges = series === null ? null : readings(series, "pledges");
  const money = pledges === null ? null : headline(pledges);
  const people =
    series === null ? null : headline(readings(series, "citizens"));
  const flightReady = r.entries.filter(
    (s) => s.vehicle.status === "flight_ready",
  ).length;
  const partTypes = new Set(r.components.map((c) => c.item.type)).size;
  const counters: Counter[] = [
    ...(money === null
      ? []
      : [
          {
            label: `Pledged since ${firstYear(pledges)}`,
            value: formatValue(money.latest.value, "pledges"),
            note: `as of ${formatDay(money.latest.day)}`,
            href: "/funding",
          },
        ]),
    ...(people === null
      ? []
      : [
          {
            label: "Citizens",
            value: formatValue(people.latest.value, "citizens"),
            note:
              people.last30 === null
                ? "on record"
                : `${signed(people.last30, (n) => formatCompact(n, "citizens"))} in the last 30 days`,
            href: "/funding?measure=citizens",
          },
        ]),
    ...(money === null || money.yearToDate === null
      ? []
      : [
          {
            label: "This year",
            value: formatCompact(money.yearToDate, "pledges"),
            note:
              money.yearToDateChange === null
                ? "so far"
                : `${formatChange(money.yearToDateChange)} on the same days of ${Number(money.latest.day.slice(0, 4)) - 1}`,
            href: "/funding",
          },
        ]),
    {
      label: "Ships on record",
      value: String(r.entries.length + concepts.length),
      note: `${flightReady} flight ready · ${concepts.length} in concept`,
      href: "/ships",
    },
    {
      label: "Parts on record",
      value: String(r.components.length),
      // The build stays in the footer's patch strip (ADR-007: one strip per page).
      note: `${partTypes} types`,
      href: "/components",
    },
  ];

  // The bento: the live example, the concept hero, then the three longest other ships with pictures.
  const candidates = [
    ...concepts.map((c) => ({
      slug: c.slug,
      length: c.length_m,
      hasPicture: conceptImage(c.slug, c.name, c.page_url) !== null,
    })),
    ...r.entries.map((s) => ({
      slug: s.vehicle.slug,
      length: s.stats?.length_m ?? null,
      hasPicture: shipCardImage(s) !== null,
    })),
  ];
  const plates: PlateEntry[] = pickPlates(
    candidates,
    LIVE_EXAMPLE,
    CONCEPT_HERO,
    3,
  ).map((pick) => {
    const concept = concepts.find((c) => c.slug === pick.slug);
    if (concept !== undefined) {
      return {
        slug: concept.slug,
        name: concept.name,
        maker: makerName(concept.manufacturer_code),
        note: [concept.focus?.toLowerCase(), "in concept"]
          .filter((s): s is string => s !== undefined)
          .join(" · "),
        picture: conceptImage(concept.slug, concept.name, concept.page_url),
      };
    }
    const ship = r.shipBySlug(pick.slug);
    if (ship === undefined) throw new Error(`no ship ${pick.slug}`);
    const showcase = showcaseFor(ship.vehicle.slug, ship.vehicle.name);
    const role = ship.vehicle.role?.toLowerCase();
    return {
      slug: ship.vehicle.slug,
      name: ship.vehicle.name,
      maker: ship.manufacturer?.name ?? ship.vehicle.manufacturer_code,
      note: [role, pick.slug === LIVE_EXAMPLE ? "the live example" : undefined]
        .filter((s): s is string => s !== undefined)
        .join(" · "),
      picture: showcase?.background ?? showcase?.poster ?? shipCardImage(ship),
    };
  });

  // Entries, A to Z: a concept ship's card shows its crew and pledge (it has no game data).
  const entries: CardProps[] = [
    ...concepts.map((c) => ({
      href: `/ships/${c.slug}`,
      name: c.name,
      manufacturer: makerName(c.manufacturer_code),
      role: c.focus,
      stats: [
        {
          label: "Crew",
          value:
            c.crew_min === null || c.crew_max === null
              ? null
              : crewRange(c.crew_min, c.crew_max),
        },
        {
          label: "Pledge",
          value: pricesFor(c.slug, null).pledge?.price_usd ?? null,
          unit: "USD",
        },
      ],
      image: conceptImage(c.slug, c.name, c.page_url),
    })),
    ...r.entries.map((ship) => shipCard(ship, shipCardImage(ship))),
  ].sort((a, b) => a.name.localeCompare(b.name, "en"));
  // The front shows the first entries A to Z; the register has them all (ADR-020). With a full
  // pack the home stays a front page, not a catalogue.
  const shown = entries.slice(0, FRONT_ENTRIES);
  const showsPrices = shown.some((e) =>
    e.stats.some((s) => s.label === "Pledge" && s.value !== null),
  );

  const feed = r.news.slice(0, 6);

  return (
    <Site>
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-col gap-6">
          {/* The date alone: the builds stay in the footer's patch strip (ADR-007, one strip per page). */}
          <p className="lab m-0 text-secondary">{formatFrontDate(at)}</p>
          <div className="grid items-end gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
            <h1 className="m-0 text-display text-primary lg:text-hero">
              Every ship, part and honour{" "}
              <span className="font-medium">on record.</span>
            </h1>
            <Contents />
          </div>
        </div>

        <Counters counters={counters} />

        <Bento cards={plates} />

        <section aria-labelledby="entries" className="flex flex-col gap-4">
          <RunningHead
            id="entries"
            title="Entries, A to Z"
            aside={
              <TextLink href="/ships" className="text-secondary">
                {entries.length > shown.length
                  ? `All ${entries.length} in the register`
                  : "The register"}
              </TextLink>
            }
          />
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 lg:grid-cols-5">
            {shown.map((entry) => (
              <li key={entry.href}>
                <Card {...entry} />
              </li>
            ))}
          </ul>
          {showsPrices ? <PriceCredit inGame={false} /> : null}
        </section>

        <section aria-labelledby="dispatches" className="flex flex-col gap-4">
          <RunningHead
            id="dispatches"
            title="Dispatches"
            aside={
              <TextLink href="/news" className="text-secondary">
                All dispatches
              </TextLink>
            }
          />
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
        </section>
      </div>
    </Site>
  );
}
