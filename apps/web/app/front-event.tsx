import type { EventRecord } from "schema";
import { eventPhase } from "schema";
import { type Repository, spectrumOn } from "../lib/data";
import {
  dayCount,
  dayLabel,
  dayStatuses,
  eventBanner,
  eventDates,
  formatUtcMoment,
  formatUtcTime,
  hullsOn,
  leadDay,
  shipResolver,
  shortTitle,
} from "../lib/events";
import {
  BandLink,
  DayStrip,
  EventOpening,
  type Status,
  dayTitle,
} from "./events/parts";

/**
 * The front page's hero while a show runs (ADR-057): at the top of the page, in the lead story's place (ADR-058),
 * from its eve (the UTC day before it opens) to the end of its last day, then gone. The show's name, the day
 * on the floor and its makers over the featured ship's picture, the links into the event page,
 * and the strip of days under it.
 */
export function FrontEvent({
  event,
  at,
  r,
}: {
  readonly event: EventRecord;
  readonly at: Date;
  readonly r: Repository;
}) {
  const phase = eventPhase(event, at);
  const lead = leadDay(event, at);
  const resolve = shipResolver(r);
  const banner = eventBanner(event, lead, resolve);
  const overArt = banner !== null;
  const href = `/events/${event.slug}`;
  const sales = spectrumOn() ? event.sales : null;
  const limited = lead === null ? [] : hullsOn(sales, lead);
  const where = [event.venue.city, event.venue.body]
    .filter((s): s is string => s !== null)
    .join(", ");
  const status: Status | null =
    phase.kind === "day" && lead !== null
      ? {
          tone: "success",
          label: `On now · ${dayLabel(lead)} of ${dayCount(event)}`,
        }
      : phase.kind === "opening"
        ? {
            tone: "neutral",
            label: `Opens today, ${formatUtcTime(event.opens_at)}`,
          }
        : phase.kind === "eve"
          ? // The date, not "tomorrow": the page is built once, and the words must stay true
            // in the minutes after midnight before the next build (ADR-057).
            {
              tone: "neutral",
              label: `Opens ${formatUtcMoment(event.opens_at)}`,
            }
          : null;
  return (
    <div className="flex flex-col gap-4">
      <EventOpening
        id="front-event"
        shape="front"
        overline={`${event.title} · ${eventDates(event)}${where === "" ? "" : ` · ${where}`}`}
        title={shortTitle(event)}
        standfirst={
          lead === null
            ? null
            : `${phase.kind === "day" ? dayLabel(lead) : "First"}: ${dayTitle(lead, r.manufacturers)}`
        }
        status={status}
        picture={banner?.picture ?? null}
        actions={
          <>
            <BandLink href={href} overArt={overArt} primary>
              Everything about {shortTitle(event)}
            </BandLink>
            {lead === null || lead.ships.length === 0 ? null : (
              <BandLink href={`${href}#today`} overArt={overArt}>
                {phase.kind === "day"
                  ? "Today's ships"
                  : "The first day's ships"}
              </BandLink>
            )}
            {limited.length === 0 ? null : (
              <BandLink href={`${href}#limited`} overArt={overArt}>
                Limited today: {limited.map((h) => h.name).join(", ")}
              </BandLink>
            )}
          </>
        }
      />
      <DayStrip event={event} statuses={dayStatuses(event, at)} base={href} />
    </div>
  );
}
