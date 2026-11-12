import NextLink from "next/link";
import type { ReactNode } from "react";
import { preconnect } from "react-dom";
import { Badge, type BadgeTone, Mark, type ResponsiveImage } from "ui";
import type { EventDay, EventRecord, EventSales, Manufacturer } from "schema";
import { media } from "../../lib/media";
import {
  type DayStatus,
  type EventShipView,
  dayAnchor,
  dayLabel,
  eventMaker,
  formatDayRange,
  formatUtcMoment,
  formatUtcTime,
  hullsByDay,
  waveMoments,
} from "../../lib/events";

/**
 * The parts of the event format (ADR-057): one opening band, the strip of days, the ship tiles,
 * a day's section, the sale's waves. The event page and the front page's hero compose them; every
 * picture is CIG's from the media manifest, under the one scrim the system allows over art.
 */

const pill =
  "rounded-pill px-3 py-1 text-caption font-medium no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

export interface Status {
  readonly tone: BadgeTone;
  readonly label: string;
}

export interface OpeningProps {
  readonly id: string;
  /** The small line over the title: the show's full name and dates. */
  readonly overline: string;
  readonly title: string;
  /** One line under the title: the day on now and its makers. */
  readonly standfirst: string | null;
  readonly status: Status | null;
  readonly picture: ResponsiveImage | null;
  /** The links under the standfirst. */
  readonly actions?: ReactNode;
  /** The band's shape: the event page's opening, or the front page's hero. */
  readonly shape: "page" | "front";
}

/**
 * The opening band: CIG's picture of the day's featured ship, full width and rounded, the status
 * and the credit over its top, the show's name over its lower part on the scrim. Without a
 * picture (CI, a clone without media) the same words stand on a toned panel.
 */
export function EventOpening({
  id,
  overline,
  title,
  standfirst,
  status,
  picture,
  actions,
  shape,
}: OpeningProps) {
  const art = picture !== null;
  const text = art ? "text-on-art" : "text-primary";
  const soft = art ? "text-on-art/80" : "text-secondary";
  // The band's picture is the page's largest paint and lives on the CDN (ADR-034): open the
  // connection with the document's head rather than when the parser reaches the image.
  if (art && /^https?:\/\//.test(picture.src)) {
    preconnect(new URL(picture.src).origin);
  }
  return (
    <section
      aria-labelledby={id}
      className={`relative overflow-hidden rounded-card shadow-lift ${art ? "bg-inset" : "bg-surface"}`}
    >
      {art ? (
        <>
          <img
            src={picture.src}
            srcSet={picture.srcSet}
            sizes="(min-width: 1400px) 1400px, 100vw"
            width={picture.width}
            height={picture.height}
            alt=""
            fetchPriority="high"
            decoding="async"
            className={`block h-auto w-full object-cover ${shape === "page" ? "aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]" : "aspect-[4/5] sm:aspect-[16/9] lg:aspect-[12/5]"}`}
          />
          <div aria-hidden="true" className="art-scrim absolute inset-0" />
        </>
      ) : null}
      <div
        className={`flex flex-wrap items-center gap-2 ${art ? "absolute inset-x-4 top-4 md:inset-x-8 md:top-6" : "px-6 pt-6 md:px-8 md:pt-8"}`}
      >
        {status === null ? null : (
          <Badge tone={status.tone}>{status.label}</Badge>
        )}
        {art ? (
          <a
            href={picture.credit.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${pill} bg-on-art/15 text-on-art md:ml-auto`}
          >
            {picture.credit.text}
          </a>
        ) : null}
      </div>
      <div
        className={`flex flex-col gap-3 ${art ? "absolute inset-x-4 bottom-4 md:inset-x-8 md:bottom-8" : "px-6 pb-6 pt-12 md:px-8 md:pb-8"}`}
      >
        <p className={`lab m-0 ${soft}`}>{overline}</p>
        <h1 id={id} className={`m-0 text-display lg:text-hero ${text}`}>
          {title}
        </h1>
        {standfirst === null ? null : (
          <p className={`m-0 max-w-prose text-heading ${text}`}>{standfirst}</p>
        )}
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

/** A link styled as a pill over the band's art or on the page. */
export function BandLink({
  href,
  overArt,
  primary = false,
  children,
}: {
  readonly href: string;
  readonly overArt: boolean;
  readonly primary?: boolean;
  readonly children: ReactNode;
}) {
  const look = overArt
    ? primary
      ? "border border-on-art/70 bg-on-art/15 text-on-art hover:bg-on-art/25"
      : "bg-on-art/15 text-on-art hover:bg-on-art/25"
    : primary
      ? "border border-accent bg-accent-bg text-primary hover:text-accent"
      : "bg-inset text-secondary hover:text-accent";
  return (
    <NextLink href={href} className={`${pill} ${look}`}>
      {children}
    </NextLink>
  );
}

const STATUS_WORD: Readonly<Record<DayStatus, string>> = {
  past: "Over",
  now: "Today",
  next: "Next",
  later: "",
};

/** A day's short title: its makers, or RSI's title for a day without (Best in Show, Finale). */
export function dayTitle(
  day: EventDay,
  manufacturers: readonly Manufacturer[],
): string {
  if (day.makers.length === 0) return sentenceTitle(day.title);
  return day.makers.map((m) => eventMaker(m, manufacturers).name).join(", ");
}

/** "Best In Show" → "Best in show": sentence case for RSI's headings that are not names. */
function sentenceTitle(title: string): string {
  return title.charAt(0) + title.slice(1).toLowerCase();
}

/** A day's title as RSI shortens it ("MISC, Mirai, Kruger Intergalactic"), for a chip. */
export function dayShortTitle(day: EventDay): string {
  return day.makers.length === 0 ? sentenceTitle(day.title) : day.title;
}

/**
 * The strip of days: one chip per entry of the schedule, the day on now selected, each linking to
 * its section on the event page. One row to swipe at every width, so the strip stays one line
 * however many days a show has.
 */
export function DayStrip({
  event,
  statuses,
  base,
}: {
  readonly event: EventRecord;
  readonly statuses: readonly DayStatus[];
  /** The event page's address, so the chips work from the front page too. */
  readonly base: string;
}) {
  return (
    <nav aria-label="Days of the show">
      <ol className="-mx-4 m-0 flex list-none snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:thin]">
        {event.days.map((day, i) => {
          const status = statuses[i] ?? "later";
          const now = status === "now";
          return (
            <li key={day.first} className="w-56 shrink-0 snap-start">
              <NextLink
                href={`${base}#${dayAnchor(day)}`}
                aria-current={now ? "true" : undefined}
                className={`flex h-full flex-col gap-1 rounded-card border px-4 py-3 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${now ? "border-accent bg-accent-bg" : "border-hairline bg-surface hover:border-hairline-strong"}`}
              >
                <span className="lab text-secondary">
                  {dayLabel(day)} · {formatDayRange(day.from, day.to)}
                  {STATUS_WORD[status] === ""
                    ? ""
                    : ` · ${STATUS_WORD[status]}`}
                </span>
                <span className="text-ui font-medium text-primary">
                  {dayShortTitle(day)}
                </span>
              </NextLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A ship of the schedule as a picture tile with its name and status; a word tile without media. */
export function ShipTile({
  ship,
  sizes,
}: {
  readonly ship: EventShipView;
  readonly sizes: string;
}) {
  const body = (
    <>
      {ship.picture === null ? (
        <div className="aspect-video w-full bg-inset" />
      ) : (
        <img
          src={ship.picture.src}
          srcSet={ship.picture.srcSet}
          sizes={sizes}
          width={ship.picture.width}
          height={ship.picture.height}
          alt=""
          loading="lazy"
          decoding="async"
          className="block aspect-video h-auto w-full object-cover"
        />
      )}
      <span className="flex flex-col gap-1 p-4">
        <span className="text-ui font-medium text-primary group-hover:text-accent">
          {ship.name}
        </span>
        {ship.status === null ? null : (
          <span className="text-caption text-secondary">{ship.status}</span>
        )}
      </span>
    </>
  );
  const box =
    "group flex h-full flex-col overflow-hidden rounded-card bg-surface no-underline shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  if (ship.href === null) return <div className={box}>{body}</div>;
  return ship.external ? (
    <a
      href={ship.href}
      target="_blank"
      rel="noopener noreferrer"
      className={box}
    >
      {body}
    </a>
  ) : (
    <NextLink href={ship.href} className={box}>
      {body}
    </NextLink>
  );
}

/** The ships of a day as tiles, four across on a desktop. */
export function ShipGrid({
  ships,
  label,
}: {
  readonly ships: readonly EventShipView[];
  readonly label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4"
    >
      {ships.map((ship, i) => (
        <li key={`${ship.name}-${i}`}>
          <ShipTile
            ship={ship}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
        </li>
      ))}
    </ul>
  );
}

/** RSI's words, quoted briefly and attributed with a link (CLAUDE.md: CIG text only briefly). */
export function RsiQuote({
  text,
  cite,
  href,
}: {
  readonly text: string;
  readonly cite: string;
  readonly href: string;
}) {
  return (
    <figure className="m-0 flex max-w-prose flex-col gap-2">
      <blockquote cite={href} className="m-0 text-body text-primary">
        “{text}”
      </blockquote>
      <figcaption className="text-caption text-secondary">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary underline decoration-hairline-strong underline-offset-2 hover:text-accent"
        >
          {cite}
        </a>
      </figcaption>
    </figure>
  );
}

/** The makers of a day with their marks where the fankit has one. */
export function MakerRow({
  day,
  manufacturers,
}: {
  readonly day: EventDay;
  readonly manufacturers: readonly Manufacturer[];
}) {
  if (day.makers.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-6 gap-y-3 p-0">
      {day.makers.map((raw) => {
        const maker = eventMaker(raw, manufacturers);
        const m = maker.manufacturer;
        const mark = m === null ? null : media().maker(m.code, m.name);
        const name =
          m === null ? (
            <span className="text-ui text-primary">{maker.name}</span>
          ) : (
            <NextLink
              href={`/manufacturers/${m.slug}`}
              className="text-ui text-primary no-underline hover:text-accent"
            >
              {maker.name}
            </NextLink>
          );
        return (
          <li key={raw} className="flex items-center gap-3">
            {mark === null ? null : <Mark mark={mark} heightClass="h-8" />}
            {name}
          </li>
        );
      })}
    </ul>
  );
}

/** The hours a day of the show runs: "13 November, 16:00 UTC to 14 November, 16:00 UTC". */
export function dayHours(day: EventDay): string {
  return `${formatUtcMoment(day.opens_at)} to ${formatUtcMoment(day.closes_at)}`;
}

/** A status for a day, for its section. */
export function dayStatus(status: DayStatus, day: EventDay): Status {
  switch (status) {
    case "now":
      return { tone: "success", label: "On the floor now" };
    case "past":
      return { tone: "neutral", label: "Over" };
    case "next":
      return {
        tone: "neutral",
        label: `Next, from ${formatUtcMoment(day.opens_at)}`,
      };
    case "later":
      return {
        tone: "neutral",
        label: `From ${formatUtcMoment(day.opens_at)}`,
      };
  }
}

/**
 * The sale's waves as a ruler of one sale day in UTC: each wave a mark at its hour along a line,
 * the ones that fall on the next calendar day said so under their hour.
 */
export function WaveRuler({ sales }: { readonly sales: EventSales }) {
  const first = sales.hulls[0];
  if (first === undefined || sales.waves.length === 0) return null;
  const moments = waveMoments(sales, first);
  return (
    <figure className="m-0 flex flex-col gap-4 rounded-card bg-surface p-6 shadow-soft">
      <figcaption className="lab text-secondary">
        {sales.waves.length} waves from a hull&apos;s first day, in UTC; one per
        account
      </figcaption>
      <ol className="relative m-0 grid list-none grid-cols-3 gap-y-4 p-0 sm:grid-cols-6">
        <li
          aria-hidden="true"
          className="absolute inset-x-0 top-6 hidden h-px bg-hairline-strong sm:block"
        />
        {moments.map((iso, i) => {
          const nextDay = iso.slice(0, 10) !== first.from;
          return (
            <li
              key={iso}
              className="relative flex flex-col items-start gap-1 sm:items-center"
            >
              <span className="text-caption text-secondary">Wave {i + 1}</span>
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-pill bg-accent"
              />
              <span className="text-ui font-medium text-primary">
                {formatUtcTime(iso).replace(" UTC", "")}
              </span>
              <span className="text-caption text-secondary">
                {nextDay ? "next day" : "sale day"}
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** The hulls by the day their waves begin, each with its picture and its six moments. */
export function HullDays({
  sales,
  resolveHull,
}: {
  readonly sales: EventSales;
  readonly resolveHull: (name: string) => EventShipView;
}) {
  return (
    <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
      {hullsByDay(sales).map((group) => {
        const moments = waveMoments(sales, group);
        return (
          <li
            key={group.from}
            className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-soft"
          >
            <p className="lab m-0 text-secondary">
              {group.day === null ? "" : `Day ${group.day} · `}
              {formatDayRange(group.from, group.from)} · first wave{" "}
              {formatUtcTime(moments[0]!)}
            </p>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
              {group.hulls.map((hull) => (
                <li key={hull.name}>
                  <ShipTile
                    ship={resolveHull(hull.name)}
                    sizes="(min-width: 768px) 25vw, 50vw"
                  />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
