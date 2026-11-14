import type { Metadata } from "next";
import {
  DevPostCard,
  DispatchCard,
  EmptyState,
  formatNumber,
  Rail,
  type ResponsiveImage,
  TextLink,
  VideoCard,
} from "ui";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { RSI_IMAGE_CREDIT, VIDEO_CREDIT, WIKI_CREDIT } from "ui/legal";
import { repo, spectrumOn } from "../lib/data";
import { authorOf, devPosts, excerptOf, threadUrl } from "../lib/dev-posts";
import { SOURCE_LABEL, coverOf } from "../lib/dispatches";
import {
  dailyPicks,
  featuredPosts,
  formatFrontDate,
  pickLead,
  pickPlates,
  signed,
  utcDayNumber,
} from "../lib/front";
import {
  formatChange,
  formatCompact,
  formatDay,
  formatReadAt,
  formatValue,
  funding,
  fundingNow,
  headline,
  type Reading,
  readings,
  sameDaysChange,
} from "../lib/funding";
import { frontEvent } from "../lib/events";
import { media, shipCardImage } from "../lib/media";
import { shipTally, tallyNote } from "../lib/ship-count";
import { withoutFixed } from "../lib/component-filters";
import { conceptShips, showcaseFor } from "../lib/showcase";
import { Site, now } from "../lib/site";
import { frontVideos, isShort, videoCard } from "../lib/videos";

/** How many dispatches the front page's carousel carries (owner, 2026-11-11: "a 5 slide scroll"). */
const FRONT_DISPATCHES = 5;
import {
  type Counter,
  Counters,
  Bento,
  type PlateEntry,
  RegisterLink,
  RunningHead,
} from "./front";
import { FrontEvent } from "./front-event";
import { FrontLead } from "./front-lead";
import { FundingCard } from "./funding-now";
import { VideoPlayer } from "./news/videos/player";

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

/** The year of the first reading, for the counter's label. */
const firstYear = (list: readonly Reading[] | null): string =>
  list?.[0]?.day.slice(0, 4) ?? "the start";

/** The owner's showcase pair (ADR-010): the concept hero and the live example. */
const CONCEPT_HERO = "odin";
const LIVE_EXAMPLE = "perseus";

/** How many ships join the pair in the bento, drawn afresh each day (ADR-038). */
const DAILY_PLATES = 3;

/**
 * The front page (ADR-020, ADR-021, ADR-038, ADR-050, ADR-057, ADR-058): the date line, then a
 * show's hero while one runs or, outside a show, the lead story as the title; the counters; then
 * the five newest dispatches (the lead left out of them) and CIG's
 * latest full videos (up to five, no Shorts), each a carousel with overlaid arrows and the same card widths, the videos'
 * player opening in place, the featured ships (the showcase pair and
 * three that change daily, with the register's count), the developers' latest posts from Spectrum
 * (only with the module on, a carousel of small cards), and this year's funding against last year's in one drawing with two
 * views, the site's one funding surface since ADR-040. On a phone the featured ships are a row to
 * swipe too, so no section is a column of tall cards (ADR-050). Without media the bento's cards hold their captions alone and the dispatch cards their
 * words.
 */
export default function HomePage() {
  const r = repo();
  const at = now();
  // A show on today (ADR-057) takes the top of the page.
  const live = frontEvent(at);
  const concepts = conceptShips();
  const makerName = (code: string): string =>
    r.manufacturers.find((m) => m.code === code)?.name ?? code;

  // Counters. The funding ones need the fixture; the record counts are always there. The latest
  // reading is RSI's counter as last read from RSI, when that is newer than the wiki's last daily
  // snapshot (ADR-018, amended 2026-11-13).
  const latestFunding = fundingNow();
  const series = latestFunding?.series ?? null;
  const counter = latestFunding?.counter ?? null;
  // When the latest reading was taken: the counter's hour, or the snapshot's day.
  const asOf = (short: boolean, day: string): string =>
    counter === null ? formatDay(day) : formatReadAt(counter.read_at, short);
  const pledges = series === null ? null : readings(series, "pledges");
  const money = pledges === null ? null : headline(pledges);
  const citizens = series === null ? null : readings(series, "citizens");
  const people = citizens === null ? null : headline(citizens);
  // Year on year from the wiki's snapshots alone while the series ends on RSI's counter, so both
  // years end on the same hour (ADR-018, amended 2026-11-13).
  const snapshots = counter === null ? null : funding();
  const wikiOf = (measure: "pledges" | "citizens") =>
    snapshots === null ? undefined : readings(snapshots, measure);
  const year = money === null ? null : Number(money.latest.day.slice(0, 4));
  const thisYearChange =
    money === null || year === null
      ? null
      : counter === null
        ? money.yearToDateChange
        : (sameDaysChange(wikiOf("pledges") ?? [], year)?.change ?? null);
  const tally = shipTally(r.entries, concepts.length);
  // The parts people fit: thrusters and fuel intakes come with the ship (ADR-046).
  const fitted = withoutFixed(r.components, false);
  const partTypes = new Set(fitted.map((c) => c.item.type)).size;
  const shipsOnRecord = tally.total;
  // The funding card's measures (ADR-040): the pledges, and the citizens with two readings.
  const cardMeasures =
    series === null || pledges === null || pledges.length < 2
      ? []
      : [
          {
            measure: "pledges" as const,
            list: pledges,
            snapshots: wikiOf("pledges"),
          },
          ...(citizens === null || citizens.length < 2
            ? []
            : [
                {
                  measure: "citizens" as const,
                  list: citizens,
                  snapshots: wikiOf("citizens"),
                },
              ]),
        ];
  // A counter opens the card on its own measure (ADR-040, amended 2026-11-12), or on the card as
  // it is when that measure is not drawn.
  const toCard = (measure: "pledges" | "citizens"): string =>
    cardMeasures.some((m) => m.measure === measure)
      ? `#funding-${measure}`
      : "#funding";
  const counters: Counter[] = [
    ...(money === null
      ? []
      : [
          {
            label: `Pledged since ${firstYear(pledges)}`,
            value: formatValue(money.latest.value, "pledges"),
            note: `as of ${asOf(true, money.latest.day)}`,
            // The pledges' figures open the card on pledges, even after a reader pressed Citizens.
            href: toCard("pledges"),
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
            // The card draws citizens too since 2026-11-11, and this opens it on them (ADR-040, amended).
            href: toCard("citizens"),
          },
        ]),
    ...(money === null || money.yearToDate === null
      ? []
      : [
          {
            label: "This year",
            value: formatCompact(money.yearToDate, "pledges"),
            note:
              thisYearChange === null || year === null
                ? "so far"
                : `${formatChange(thisYearChange)} on the same days of ${year - 1}`,
            href: toCard("pledges"),
          },
        ]),
    {
      label: "Ships on record",
      value: String(shipsOnRecord),
      note: tallyNote(tally),
      href: "/ships",
    },
    {
      label: "Parts on record",
      value: String(fitted.length),
      // The build stays in the footer's patch strip (ADR-007: one strip per page).
      note: `${partTypes} types, not counting ${formatNumber(r.components.length - fitted.length)} built-in thrusters and fuel intakes`,
      href: "/components",
    },
  ];

  // The lead story (ADR-058): outside a show, the picture-led story of the latest day before
  // today, a Comm-Link before a video; it changes at most once a day.
  const lead =
    live === null
      ? pickLead(
          r.dispatches,
          r.videos,
          (id) => media().cover(id) !== null,
          isShort,
          at,
        )
      : null;
  const leadId = lead?.lead.id ?? null;

  // The five newest dispatches as a carousel (ADR-029, ADR-050), the lead story left out of them.
  const feed = r.dispatches
    .filter((item) => item.id !== leadId)
    .slice(0, FRONT_DISPATCHES);
  const feedPictures = feed.map((item) => coverOf(item));

  // The bento: the showcase pair, then three ships drawn for the day from those with pictures.
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
  const pair = pickPlates(candidates, LIVE_EXAMPLE, CONCEPT_HERO, 0);
  const daily = dailyPicks(
    candidates.filter((c) => !pair.some((p) => p.slug === c.slug)),
    utcDayNumber(at),
    DAILY_PLATES,
  );
  const plates: PlateEntry[] = [...pair, ...daily].map((pick) => {
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

  // The developers' latest (ADR-038): only with the Spectrum module on, like every Spectrum surface.
  const devOn = spectrumOn();
  const posts = devOn ? devPosts(r.news) : [];
  const featured = featuredPosts(posts, at);

  // CIG's latest on YouTube (ADR-050): the newest of both channels, the player opening in place.
  // Full videos only, no Shorts (owner, 2026-11-11); the videos tab carries every upload.
  const latestVideos = frontVideos(r.videos);

  return (
    <Site>
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-col gap-6">
          {/* The date alone: the builds stay in the footer's patch strip (ADR-007, one strip per page). */}
          <p className="lab m-0 text-secondary">
            {formatFrontDate(at)} · in the ’verse
          </p>
          {live !== null ? (
            // A show on (ADR-057): its hero stands at the top of the page.
            <FrontEvent event={live} at={at} r={r} />
          ) : lead !== null ? (
            // Outside a show, the lead story (ADR-058).
            <FrontLead item={lead.lead} video={lead.video} now={at} />
          ) : (
            // An empty pack: the site's own words as the title.
            <h1 className="m-0 max-w-prose text-title text-primary lg:text-display">
              {SITE_TAGLINE}
            </h1>
          )}
        </div>

        <Counters counters={counters} />

        <section aria-labelledby="dispatches" className="flex flex-col gap-4">
          <RunningHead
            id="dispatches"
            title="Dispatches from the Verse"
            aside={
              <TextLink href="/news" className="text-secondary">
                All dispatches
              </TextLink>
            }
          />
          {feed.length === 0 ? (
            <EmptyState>
              No dispatches yet. What CIG publishes will appear here; until
              then, browse the <TextLink href="/ships">ships</TextLink>.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Five as a carousel with overlaid arrows, three across on a desktop (ADR-050). */}
              <Rail label="Dispatches from the Verse">
                {feed.map((item, i) => (
                  <DispatchCard
                    key={item.id}
                    source={SOURCE_LABEL[item.source]}
                    title={item.title}
                    sourceUrl={item.url}
                    publishedAt={item.published_at}
                    now={at}
                    excerpt={item.summary}
                    picture={feedPictures[i] ?? null}
                    // The page's first picture, unless a show's hero (ADR-057) or the lead story
                    // (ADR-058) stands above it.
                    priority={i === 0 && live === null && lead === null}
                  />
                ))}
              </Rail>
              {feedPictures.some((p) => p !== null) ? (
                <p className="m-0 text-caption text-muted">
                  {RSI_IMAGE_CREDIT.text}
                </p>
              ) : null}
            </div>
          )}
        </section>

        {latestVideos.length === 0 ? null : (
          <section aria-labelledby="videos" className="flex flex-col gap-4">
            <RunningHead
              id="videos"
              title="Latest videos"
              aside={
                <TextLink href="/news/videos" className="text-secondary">
                  All videos
                </TextLink>
              }
            />
            <div className="flex flex-col gap-2">
              {/* The same carousel and the same card widths as the dispatches (owner, 2026-11-11). */}
              <Rail label="Latest videos">
                {latestVideos.map((item) => (
                  <VideoCard
                    key={item.id}
                    {...videoCard(item, at)}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 80vw"
                  />
                ))}
              </Rail>
              <p className="m-0 text-caption text-muted">{VIDEO_CREDIT.text}</p>
            </div>
          </section>
        )}

        <section aria-labelledby="featured" className="flex flex-col gap-4">
          <RunningHead
            id="featured"
            title="Featured vehicles and ships"
            aside="Changes daily"
          />
          <Bento cards={plates} />
          <RegisterLink count={shipsOnRecord} />
        </section>

        {devOn ? (
          <section aria-labelledby="developers" className="flex flex-col gap-4">
            <RunningHead
              id="developers"
              title="Developer gold posts"
              aside={
                <TextLink href="/news/dev" className="text-secondary">
                  All developer gold posts
                </TextLink>
              }
            />
            {featured.length === 0 ? (
              <EmptyState>
                No developer gold posts yet. The tracker has not read Spectrum.
              </EmptyState>
            ) : (
              <Rail label="Developer gold posts">
                {featured.map((post) => {
                  const who = authorOf(post, r.authors);
                  return (
                    <DevPostCard
                      key={post.id}
                      title={post.thread_title ?? post.title}
                      author={
                        who === undefined
                          ? { name: "CIG staff", role: null }
                          : {
                              name: who.display_name,
                              role: who.role,
                              href: `/news/dev/${encodeURIComponent(who.handle)}`,
                            }
                      }
                      publishedAt={post.published_at}
                      now={at}
                      excerpt={excerptOf(post.body_html)}
                      sourceUrl={post.url}
                      threadUrl={threadUrl(post)}
                    />
                  );
                })}
              </Rail>
            )}
          </section>
        ) : null}

        {series === null || cardMeasures.length === 0 ? null : (
          <section
            aria-labelledby="funding"
            className="flex scroll-mt-8 flex-col gap-4"
          >
            <RunningHead
              id="funding"
              title="Funding this year"
              aside={
                money === null
                  ? undefined
                  : `as of ${asOf(false, money.latest.day)}`
              }
            />
            <FundingCard anchor="funding" measures={cardMeasures} />
            {/* The ledger's sources line, now the card's (ADR-040); the wiki's credit is in every footer. */}
            <p className="m-0 max-w-prose text-caption text-secondary">
              Daily snapshots of RSI&apos;s counter on{" "}
              <TextLink href={series.source.origin_url} external>
                robertsspaceindustries.com
              </TextLink>
              , as recorded by the{" "}
              <TextLink href={WIKI_CREDIT.url} external>
                Star Citizen Wiki API
              </TextLink>
              ; copied {formatDay(series.source.fetched_at.slice(0, 10))}.
              {counter === null
                ? null
                : ` The latest figures are RSI's counter itself, read ${formatReadAt(counter.read_at)}; it is read about once an hour.`}{" "}
              Months, years and comparisons are differences between snapshots;
              where the API has none within three days of a period&apos;s ends,
              the period is left blank rather than estimated.
            </p>
          </section>
        )}
      </div>
      {latestVideos.length === 0 ? null : <VideoPlayer />}
    </Site>
  );
}
