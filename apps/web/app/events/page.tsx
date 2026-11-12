import type { Metadata } from "next";
import NextLink from "next/link";
import { EmptyState, TextLink } from "ui";
import { eventPhase } from "schema";
import { repo } from "../../lib/data";
import {
  dayCount,
  eventBanner,
  eventDates,
  events,
  leadDay,
  shipResolver,
  shortTitle,
} from "../../lib/events";
import { Site, now } from "../../lib/site";
import { RunningHead } from "../front";
import { Credits } from "./parts";

export const metadata: Metadata = {
  title: "Events",
  description:
    "CIG's shows as RSI publishes them: the Intergalactic Aerospace Expo, Invictus Launch Week, CitizenCon and the rest, each with its days, makers, ships and limited sales.",
  alternates: { canonical: "/events" },
};

/** Every show on file (ADR-057), the latest first, each a picture card into its page. */
export default function EventsPage() {
  const r = repo();
  const at = now();
  const resolve = shipResolver(r);
  const list = events();
  const cards = list.map((event) => {
    const phase = eventPhase(event, at);
    return {
      event,
      banner: eventBanner(event, leadDay(event, at), resolve),
      state:
        phase.kind === "day"
          ? "On now"
          : phase.kind === "opening"
            ? "Opens today"
            : phase.kind === "after"
              ? "Over"
              : "Coming",
    };
  });
  return (
    <Site>
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-display text-primary lg:text-hero">Events</h1>
          <p className="m-0 max-w-prose text-body text-secondary">
            CIG&apos;s shows as RSI publishes them, read from its own schedule
            each time a show&apos;s day turns over.
          </p>
        </div>
        <section aria-labelledby="shows" className="flex flex-col gap-4">
          <RunningHead
            id="shows"
            title="The shows"
            aside={`${list.length} on file`}
          />
          {list.length === 0 ? (
            <EmptyState>
              No show on file yet. When RSI publishes one, it appears here;
              until then, browse the <TextLink href="/ships">ships</TextLink>.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
                {cards.map(({ event, banner, state }, i) => {
                  return (
                    <li key={event.slug}>
                      <NextLink
                        href={`/events/${event.slug}`}
                        className="group relative block overflow-hidden rounded-card bg-inset no-underline shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {banner === null ? (
                          <div className="aspect-video w-full" />
                        ) : (
                          <img
                            src={banner.picture.src}
                            srcSet={banner.picture.srcSet}
                            sizes="(min-width: 768px) 50vw, 100vw"
                            width={banner.picture.width}
                            height={banner.picture.height}
                            alt=""
                            fetchPriority={i === 0 ? "high" : undefined}
                            loading={i === 0 ? undefined : "lazy"}
                            decoding="async"
                            className="block aspect-video h-auto w-full object-cover"
                          />
                        )}
                        <div
                          className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 p-6 ${banner === null ? "" : "art-scrim pt-16"}`}
                        >
                          <p
                            className={`lab m-0 ${banner === null ? "text-secondary" : "text-on-art/80"}`}
                          >
                            {state} · {eventDates(event)} · {dayCount(event)}{" "}
                            days
                          </p>
                          <p
                            className={`m-0 text-heading ${banner === null ? "text-primary" : "text-on-art"}`}
                          >
                            {shortTitle(event)}: {event.title}
                          </p>
                        </div>
                      </NextLink>
                    </li>
                  );
                })}
              </ul>
              <Credits pictures={cards.map((c) => c.banner?.picture ?? null)} />
            </div>
          )}
        </section>
      </div>
    </Site>
  );
}
