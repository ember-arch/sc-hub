import type { Metadata } from "next";
import {
  DevPost,
  DispatchCard,
  EmptyState,
  type ResponsiveImage,
  TextLink,
} from "ui";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { RSI_IMAGE_CREDIT, WIKI_CREDIT } from "ui/legal";
import { repo, spectrumOn } from "../lib/data";
import {
  authorOf,
  devPosts,
  excerptOf,
  renderBody,
  threadUrl,
} from "../lib/dev-posts";
import { SOURCE_LABEL, coverOf } from "../lib/dispatches";
import {
  dailyLine,
  dailyPicks,
  featuredPosts,
  formatFrontDate,
  freshestStaffWord,
  pickPlates,
  shortBuild,
  signed,
  utcDayNumber,
} from "../lib/front";
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
import { shipTally, tallyNote } from "../lib/ship-count";
import { withoutFixed } from "../lib/component-filters";
import { conceptShips, showcaseFor } from "../lib/showcase";
import { Site, now } from "../lib/site";
import {
  Contents,
  type Counter,
  Counters,
  Bento,
  type PlateEntry,
  RegisterLink,
  RunningHead,
} from "./front";
import { FundingNow } from "./funding-now";

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
 * The front page (ADR-020, ADR-021, ADR-038, ADR-042): the date line, the daily line composed
 * from the pack as the title, the contents, the counters; then the newest dispatches, the featured ships (the showcase pair and
 * three that change daily, with the register's count), the developers' latest posts from Spectrum
 * (only with the module on), and this year's funding against last year's in one drawing with two
 * views, the site's one funding surface since ADR-040. Without media the bento's cards hold their captions alone and the dispatch cards their
 * words.
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
  const tally = shipTally(r.entries, concepts.length);
  // The parts people fit: thrusters and fuel intakes come with the ship (ADR-046).
  const fitted = withoutFixed(r.components, false);
  const partTypes = new Set(fitted.map((c) => c.item.type)).size;
  const shipsOnRecord = tally.total;
  const counters: Counter[] = [
    ...(money === null
      ? []
      : [
          {
            label: `Pledged since ${firstYear(pledges)}`,
            value: formatValue(money.latest.value, "pledges"),
            note: `as of ${formatDay(money.latest.day)}`,
            href: "#funding",
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
            href: "#funding",
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
      note: `${partTypes} types · ${r.components.length - fitted.length} built-in thrusters and intakes aside`,
      href: "/components",
    },
  ];

  // The three newest dispatches as cards (ADR-029), first on the page (ADR-038).
  const feed = r.dispatches.slice(0, 3);
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
  const pictures = media();

  // The daily line (ADR-042): composed from what the pack says today, never written.
  const staffWord = freshestStaffWord(posts, at);
  const newest = feed[0];
  const line = dailyLine(
    {
      staffThread:
        staffWord === null
          ? null
          : {
              title: staffWord.thread_title ?? staffWord.title,
              publishedAt: staffWord.published_at,
              // A reply's address ends in its number; the thread's own page does not.
              reply: /\/\d+$/.test(staffWord.url),
            },
      dispatch:
        newest === undefined
          ? null
          : { title: newest.title, publishedAt: newest.published_at },
      builds: {
        live: shortBuild(
          r.versions.find((v) => v.channel === "LIVE")?.version ?? null,
        ),
        ptu: shortBuild(
          r.versions.find((v) => v.channel === "PTU")?.version ?? null,
        ),
      },
      funding:
        money === null || money.yearToDate === null
          ? null
          : {
              year: Number(money.latest.day.slice(0, 4)),
              yearToDate: formatCompact(money.yearToDate, "pledges"),
              change:
                money.yearToDateChange === null
                  ? null
                  : formatChange(money.yearToDateChange),
            },
    },
    at,
    utcDayNumber(at),
  );

  return (
    <Site>
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-col gap-6">
          {/* The date alone: the builds stay in the footer's patch strip (ADR-007, one strip per page). */}
          <p className="lab m-0 text-secondary">
            {formatFrontDate(at)} · in the ’verse
          </p>
          <div className="grid items-end gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
            {/* The daily line (ADR-042): what the pack says today, composed by rule. */}
            <h1 className="m-0 max-w-prose text-title text-primary lg:text-display">
              {line}
            </h1>
            <Contents />
          </div>
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
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
                {feed.map((item, i) => (
                  <li key={item.id}>
                    <DispatchCard
                      source={SOURCE_LABEL[item.source]}
                      title={item.title}
                      sourceUrl={item.url}
                      publishedAt={item.published_at}
                      now={at}
                      excerpt={item.summary}
                      picture={feedPictures[i] ?? null}
                      // The page's first picture, and usually its largest paint.
                      priority={i === 0}
                    />
                  </li>
                ))}
              </ul>
              {feedPictures.some((p) => p !== null) ? (
                <p className="m-0 text-caption text-muted">
                  {RSI_IMAGE_CREDIT.text}
                </p>
              ) : null}
            </div>
          )}
        </section>

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
              title="Featured developer posts"
              aside={
                <TextLink href="/news/dev" className="text-secondary">
                  All developer posts
                </TextLink>
              }
            />
            {featured.length === 0 ? (
              <EmptyState>
                No developer posts yet. The tracker has not read Spectrum.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {featured.map((post) => {
                  const who = authorOf(post, r.authors);
                  return (
                    <DevPost
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
                      bodyHtml={renderBody(
                        post.body_html,
                        (id) => pictures.spectrumUpload(id),
                        post.url,
                      )}
                      excerpt={excerptOf(post.body_html)}
                      sourceUrl={post.url}
                      threadUrl={threadUrl(post)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {series === null || pledges === null || pledges.length < 2 ? null : (
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
                  : `as of ${formatDay(money.latest.day)}`
              }
            />
            <FundingNow list={pledges} measure="pledges" />
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
              Months, years and comparisons are differences between snapshots;
              where the API has none within three days of a period&apos;s ends,
              the period is left blank rather than estimated.
            </p>
          </section>
        )}
      </div>
    </Site>
  );
}
