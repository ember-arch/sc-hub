import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { DispatchCard, Rail, TextLink } from "ui";
import { eventPhase } from "schema";
import { repo, spectrumOn } from "../../../lib/data";
import { SOURCE_LABEL, coverOf } from "../../../lib/dispatches";
import {
  dayAnchor,
  dayBanner,
  dayCount,
  dayLabel,
  dayStatuses,
  eventBanner,
  eventBySlug,
  eventDates,
  eventNews,
  events,
  formatDayRange,
  formatLongDay,
  formatUtcMoment,
  formatUtcTime,
  hullResolver,
  hullsOn,
  leadDay,
  shipResolver,
  shortTitle,
} from "../../../lib/events";
import { Site, now } from "../../../lib/site";
import { RunningHead } from "../../front";
import {
  BandLink,
  Credits,
  DayStrip,
  EventOpening,
  MakerRow,
  RsiQuote,
  ShipGrid,
  type Status,
  dayHours,
  dayStatus,
  dayTitle,
  HullDays,
  WaveRuler,
} from "../parts";

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return events().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = eventBySlug(slug);
  if (event === undefined) return { title: "Event not found" };
  const where = [event.venue.city, event.venue.body].filter(Boolean).join(", ");
  return {
    title: shortTitle(event),
    description: `${event.title}, ${eventDates(event)}${where === "" ? "" : `, ${where}`}: each day's makers and ships, and the limited sales, from RSI's own schedule.`,
    alternates: { canonical: `/events/${event.slug}` },
  };
}

/**
 * The event page (ADR-057): the canonical format for CIG's shows. The opening band on the day's
 * featured ship, the facts, the day on the floor now with every ship it puts up, the limited
 * sales, the schedule day by day, the dispatches about the show and the sources. Every fact is
 * RSI's, read by `scripts/events/fetch.ts`; the page is as current as its last build, and the
 * events step makes a build each time the show's day turns over.
 */
export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const event = eventBySlug(slug);
  if (event === undefined) notFound();
  const r = repo();
  const at = now();
  const phase = eventPhase(event, at);
  const statuses = dayStatuses(event, at);
  const lead = leadDay(event, at);
  const resolve = shipResolver(r);
  const resolveHull = hullResolver(resolve);
  const banner = eventBanner(event, lead, resolve);
  const schedule = event.sources.find((s) => s.kind === "comm_link")!;
  const sales = spectrumOn() ? event.sales : null;
  const total = dayCount(event);
  const shipCount = new Set(
    event.days.flatMap((d) => d.ships.map((s) => s.name)),
  ).size;
  const where = [event.venue.place, event.venue.city, event.venue.body]
    .filter((s): s is string => s !== null)
    .join(", ");

  const status: Status =
    phase.kind === "day"
      ? {
          tone: "success",
          label: `On now · ${dayLabel(lead!)} of ${total}`,
        }
      : phase.kind === "after"
        ? { tone: "neutral", label: `Over · ran ${eventDates(event)}` }
        : phase.kind === "opening" || phase.kind === "eve"
          ? {
              tone: "neutral",
              label: `Opens ${phase.kind === "eve" ? "tomorrow" : "today"}, ${formatUtcTime(event.opens_at)}`,
            }
          : {
              tone: "neutral",
              label: `Opens ${formatUtcMoment(event.opens_at)}`,
            };
  const standfirst =
    lead === null
      ? null
      : `${phase.kind === "day" ? "On the floor" : "First on the floor"}: ${dayTitle(lead, r.manufacturers)}`;
  const leadView = lead === null ? null : lead.ships.map(resolve);
  const news = eventNews(event, r.dispatches);

  const facts: { label: string; value: string; note: string }[] = [
    {
      label: "When",
      value: eventDates(event),
      note: `Doors open ${formatUtcMoment(event.opens_at)}; each day of the schedule opens at ${formatUtcTime(event.opens_at)}`,
    },
    ...(where === ""
      ? []
      : [
          {
            label: "Where",
            value: where,
            note:
              event.venue.system === null ? "" : `${event.venue.system} system`,
          },
        ]),
    {
      label: "On the floor",
      value: `${shipCount} ships and vehicles`,
      note: `On the schedule over ${total} days`,
    },
    ...(sales === null || sales.hulls[0] === undefined
      ? []
      : [
          {
            label: "Limited sales",
            value: `${sales.hulls.length} hulls`,
            note: `${sales.waves.length} waves from a hull's first day, the first from ${formatDayRange(sales.hulls[0].from, sales.hulls[0].from)}`,
          },
        ]),
  ];

  return (
    <Site>
      <div className="flex flex-col gap-12 pt-8">
        <div className="flex flex-col gap-4">
          <EventOpening
            id="event-title"
            shape="page"
            overline={`${shortTitle(event)} · ${eventDates(event)}`}
            title={event.title}
            standfirst={standfirst}
            status={status}
            picture={banner?.picture ?? null}
            actions={
              <>
                {lead === null ? null : (
                  <BandLink href="#today" overArt={banner !== null} primary>
                    {phase.kind === "day"
                      ? "Today's ships"
                      : "The first day's ships"}
                  </BandLink>
                )}
                {sales === null ? null : (
                  <BandLink href="#limited" overArt={banner !== null}>
                    Limited sales
                  </BandLink>
                )}
                <BandLink href="#schedule" overArt={banner !== null}>
                  The schedule
                </BandLink>
              </>
            }
          />
          <DayStrip
            event={event}
            statuses={statuses}
            base={`/events/${event.slug}`}
          />
        </div>

        <dl className="m-0 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <div
              key={f.label}
              className="flex flex-col gap-1 border-t border-hairline pt-3"
            >
              <dt className="lab text-secondary">{f.label}</dt>
              <dd className="m-0 text-heading text-primary">{f.value}</dd>
              {f.note === "" ? null : (
                <dd className="m-0 text-caption text-secondary">{f.note}</dd>
              )}
            </div>
          ))}
        </dl>

        {lead === null || leadView === null ? null : (
          <section
            aria-labelledby="today"
            className="flex scroll-mt-8 flex-col gap-6"
          >
            <RunningHead
              id="today"
              title={
                phase.kind === "day"
                  ? "On the floor today"
                  : "First on the floor"
              }
              aside={`${dayLabel(lead)} · ${formatDayRange(lead.from, lead.to)}`}
            />
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
              <div className="flex flex-col gap-4">
                <h3 className="m-0 text-heading text-primary">
                  {dayTitle(lead, r.manufacturers)}
                </h3>
                <MakerRow day={lead} manufacturers={r.manufacturers} />
                {lead.lead === null ? null : (
                  <RsiQuote
                    text={lead.lead}
                    cite={`RSI, the ${shortTitle(event)} schedule`}
                    href={schedule.url}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 rounded-card bg-surface p-6 shadow-soft">
                <p className="lab m-0 text-secondary">Free to fly</p>
                <p className="m-0 text-ui text-primary">{dayHours(lead)}</p>
                {hullsOn(sales, lead).length === 0 ? null : (
                  <p className="m-0 text-ui text-primary">
                    Limited from today:{" "}
                    {hullsOn(sales, lead)
                      .map((h) => h.name)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
            {leadView.length === 0 ? null : (
              <div className="flex flex-col gap-2">
                <ShipGrid
                  ships={leadView}
                  label={`Ships of ${dayLabel(lead)}`}
                />
                <Credits pictures={leadView.map((v) => v.picture)} />
              </div>
            )}
          </section>
        )}

        {sales === null ? null : (
          <section
            aria-labelledby="limited"
            className="flex scroll-mt-8 flex-col gap-6"
          >
            <RunningHead
              id="limited"
              title="Limited sales"
              aside={
                <TextLink
                  href={sales.source.url}
                  external
                  className="text-secondary"
                >
                  RSI's FAQ on Spectrum
                </TextLink>
              }
            />
            <WaveRuler sales={sales} />
            <HullDays sales={sales} resolveHull={resolveHull} />
            {sales.notes.length === 0 ? null : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {sales.notes.map((note) => (
                  <li key={note}>
                    <RsiQuote
                      text={note}
                      cite="RSI, the show's FAQ"
                      href={sales.source.url}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section
          aria-labelledby="schedule"
          className="flex scroll-mt-8 flex-col gap-6"
        >
          <RunningHead
            id="schedule"
            title="The schedule"
            aside={`${total} days · ${shipCount} ships and vehicles`}
          />
          <ol className="m-0 flex list-none flex-col gap-12 p-0">
            {event.days.map((day, i) => {
              const s = statuses[i] ?? "later";
              const pic = dayBanner(day, event, resolve);
              const ships = day.ships.map(resolve);
              return (
                <li
                  key={day.first}
                  id={dayAnchor(day)}
                  className={`scroll-mt-8 ${i === 0 ? "" : "border-t border-hairline pt-12"}`}
                >
                  <article
                    aria-labelledby={`${dayAnchor(day)}-title`}
                    className="grid gap-6 lg:grid-cols-[2fr_3fr]"
                  >
                    <div className="overflow-hidden rounded-card bg-inset shadow-soft">
                      {pic === null ? (
                        <div className="aspect-video w-full" />
                      ) : (
                        <img
                          src={pic.picture.src}
                          srcSet={pic.picture.srcSet}
                          sizes="(min-width: 1024px) 40vw, 100vw"
                          width={pic.picture.width}
                          height={pic.picture.height}
                          alt={`The ${pic.ship.name}`}
                          loading="lazy"
                          decoding="async"
                          className="block aspect-video h-auto w-full object-cover"
                        />
                      )}
                      {pic === null ? null : (
                        <p className="m-0 px-4 py-2 text-caption text-muted">
                          <a
                            href={pic.picture.credit.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted no-underline hover:text-accent"
                          >
                            {pic.picture.credit.text}
                          </a>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      <p className="lab m-0 text-secondary">
                        {dayLabel(day)} · {formatDayRange(day.from, day.to)}
                      </p>
                      <h3
                        id={`${dayAnchor(day)}-title`}
                        className="m-0 text-heading text-primary"
                      >
                        {dayTitle(day, r.manufacturers)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-pill bg-inset px-2 py-1 text-caption font-medium ${s === "now" ? "text-success" : "text-secondary"}`}
                        >
                          {dayStatus(s, day).label}
                        </span>
                        {hullsOn(sales, day).map((h) => (
                          <span
                            key={h.name}
                            className="rounded-pill bg-inset px-2 py-1 text-caption text-secondary"
                          >
                            Limited: {h.name}
                          </span>
                        ))}
                      </div>
                      {day.lead === null ? null : (
                        <RsiQuote
                          text={day.lead}
                          cite={`RSI, ${dayLabel(day).toLowerCase()}`}
                          href={schedule.url}
                        />
                      )}
                      {ships.length === 0 ? null : (
                        <ul className="m-0 columns-1 list-none gap-6 p-0 text-ui sm:columns-2 xl:columns-3">
                          {ships.map((ship, j) => (
                            <li
                              key={`${ship.name}-${j}`}
                              className="break-inside-avoid py-1"
                            >
                              {ship.href === null ? (
                                <span className="text-primary">
                                  {ship.name}
                                </span>
                              ) : ship.external ? (
                                <a
                                  href={ship.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary no-underline hover:text-accent"
                                >
                                  {ship.name}
                                </a>
                              ) : (
                                <NextLink
                                  href={ship.href}
                                  className="text-primary no-underline hover:text-accent"
                                >
                                  {ship.name}
                                </NextLink>
                              )}
                              {ship.status === "In concept" ? (
                                <span className="text-caption text-secondary">
                                  {" "}
                                  · in concept
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        {news.length === 0 ? null : (
          <section aria-labelledby="dispatches" className="flex flex-col gap-4">
            <RunningHead
              id="dispatches"
              title="From the show floor"
              aside="RSI's dispatches about the show"
            />
            <Rail label="From the show floor">
              {news.map((item) => (
                <DispatchCard
                  key={item.id}
                  source={SOURCE_LABEL[item.source]}
                  title={item.title}
                  sourceUrl={item.url}
                  publishedAt={item.published_at}
                  now={at}
                  excerpt={item.summary}
                  picture={coverOf(item)}
                />
              ))}
            </Rail>
          </section>
        )}

        <section aria-labelledby="sources" className="flex flex-col gap-3">
          <RunningHead id="sources" title="Sources" />
          <ul className="m-0 flex max-w-prose list-none flex-col gap-2 p-0 text-caption text-secondary">
            <li>
              The days, makers and ships: RSI&apos;s Comm-Link{" "}
              <TextLink href={schedule.url} external>
                {schedule.title}
              </TextLink>
              , published {formatLongDay(schedule.published_at.slice(0, 10))};
              read again each time the show moves on and once a day while it
              runs, the record last changed{" "}
              {formatLongDay(event.fetched_at.slice(0, 10))}.
            </li>
            <li>
              Each day&apos;s hours are this site&apos;s reading of RSI&apos;s
              dates at the opening hour RSI gives (
              {formatUtcTime(event.opens_at)}): RSI gives the dates, not when
              each day closes.
            </li>
            {sales === null ? null : (
              <li>
                The limited sales: RSI&apos;s{" "}
                <TextLink href={sales.source.url} external>
                  {sales.source.title}
                </TextLink>{" "}
                on Spectrum, as collected by the developer-post tracker.
              </li>
            )}
            <li>
              RSI&apos;s words are quoted briefly and linked to the page they
              come from. The pictures are the register&apos;s own of each ship,
              each credited where it shows.
            </li>
          </ul>
        </section>
      </div>
    </Site>
  );
}
