import { Fragment, type ReactNode } from "react";
import type { Title, WikiText } from "schema";
import { Badge, type BadgeTone, TextLink, formatNumber } from "ui";
import { type GuideGrid, type TitleStatus, statusOf } from "../../lib/titles";
import type { TitleIconImage } from "../../lib/title-icons";

/**
 * The honours page's pieces (ADR-017, ADR-020). Icons are drawn as they come, never tinted or
 * framed with effects, each on a slate well (the dark almanac's paper, so a badge drawn for RSI's
 * dark pages reads in both modes); a title without a built icon has no well at all (an empty box is
 * chrome the reader could lose, ADR-006). Wiki text is rendered verbatim, its links out kept.
 */

export type IconLookup = (title: Title) => TitleIconImage | null;

/** The wiki's text as written, with its links to other sites. */
export function WikiTextView({ runs }: { readonly runs: WikiText }) {
  return (
    <>
      {runs.map((run, i) =>
        run.href === null ? (
          <Fragment key={i}>{run.text}</Fragment>
        ) : (
          <TextLink key={i} href={run.href} external>
            {run.text}
          </TextLink>
        ),
      )}
    </>
  );
}

const STATUS_BADGE: Readonly<
  Record<TitleStatus, { readonly tone: BadgeTone; readonly label: string }>
> = {
  earnable: { tone: "success", label: "Earnable" },
  "not-earnable": { tone: "neutral", label: "No longer earnable" },
  unknown: { tone: "neutral", label: "Status unknown" },
};

export function StatusBadge({ status }: { readonly status: TitleStatus }) {
  const badge = STATUS_BADGE[status];
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

/**
 * The icon at up to `max` CSS pixels and never more than twice its own size, so the smallest
 * originals (20 px) are not blown up into a blur.
 */
function Icon({
  image,
  max,
}: {
  readonly image: TitleIconImage;
  readonly max: 64 | 48;
}) {
  const natural = Math.max(image.naturalWidth, image.naturalHeight);
  const size =
    max === 64 && natural >= 32
      ? "size-16"
      : natural >= 24
        ? "size-12"
        : "size-8";
  return (
    // Inside <picture> React adds no preload hint, so pages that link here do not fetch icons.
    <picture>
      <img
        src={image.src}
        srcSet={image.srcSet}
        width={image.width}
        height={image.height}
        alt=""
        loading="lazy"
        decoding="async"
        className={`block object-contain ${size}`}
      />
    </picture>
  );
}

const anchor =
  "scroll-mt-8 target:border-accent target:outline target:outline-1 target:outline-accent";

function Figure({
  value,
  unit,
}: {
  readonly value: string;
  readonly unit: string;
}) {
  return (
    <p className="m-0 flex items-baseline gap-2">
      <span className="font-mono text-ui text-primary">{value}</span>
      <span className="text-caption text-secondary">{unit}</span>
    </p>
  );
}

function Sources({ title }: { readonly title: Title }) {
  if (title.sources.length === 0) return null;
  return (
    <p className="m-0 text-caption text-secondary">
      {title.sources.length === 1 ? "Source: " : "Sources: "}
      {title.sources.map((s, i) => (
        <Fragment key={s.url}>
          {i > 0 ? ", " : null}
          <TextLink href={s.url} external>
            {s.label}
          </TextLink>
        </Fragment>
      ))}
    </p>
  );
}

/** A rung of a ladder (backer, recruitment): the icon large, the threshold as a figure. */
export function LadderTile({
  title,
  icon,
}: {
  readonly title: Title;
  readonly icon: TitleIconImage | null;
}) {
  const req = title.requirement;
  return (
    <li
      id={title.slug}
      className={`flex flex-col gap-3 rounded-card bg-surface shadow-soft p-3 ${anchor}`}
    >
      {icon === null ? null : (
        <div
          data-theme="dark"
          className="flex h-24 items-center justify-center border border-hairline bg-page"
        >
          <Icon image={icon} max={64} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="m-0 text-heading text-primary">{title.name}</p>
        {req?.kind === "pledge_total" ? (
          <Figure value={`$${formatNumber(req.usd)}`} unit="pledge total" />
        ) : null}
        {req?.kind === "recruits" ? (
          <Figure
            value={formatNumber(req.count)}
            unit={req.count === 1 ? "recruit" : "recruits"}
          />
        ) : null}
        {title.packages !== null && title.packages.length > 0 ? (
          <p className="m-0 text-caption text-secondary">
            Originally with {title.packages.map((p) => `“${p}”`).join(", ")}
          </p>
        ) : null}
        {title.reward === null ? null : (
          <div className="mt-2 flex flex-col gap-1 border-t border-hairline pt-2">
            {title.reward.name === null ? null : (
              <p className="m-0 text-caption text-primary">
                {title.reward.name}
              </p>
            )}
            <p className="m-0 text-caption text-secondary">
              <WikiTextView runs={title.reward.text} />
            </p>
          </div>
        )}
        <Sources title={title} />
      </div>
    </li>
  );
}

/** A title earned by an event or action: its icon beside the wiki's sentence. */
export function TitleCard({
  title,
  icon,
  showStatus,
}: {
  readonly title: Title;
  readonly icon: TitleIconImage | null;
  readonly showStatus: boolean;
}) {
  const status = statusOf(title);
  const held = title.group === "unique" || title.group === "official";
  return (
    <li
      id={title.slug}
      className={`flex gap-4 rounded-card bg-surface shadow-soft p-4 ${anchor}`}
    >
      {icon === null ? null : (
        <div
          data-theme="dark"
          className="flex size-24 shrink-0 items-center justify-center border border-hairline bg-page"
        >
          <Icon image={icon} max={64} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-heading text-primary">{title.name}</p>
          {showStatus && status !== null ? (
            <StatusBadge status={status} />
          ) : null}
        </div>
        {title.requirement?.kind === "recruitment_period" ? (
          <Labelled label="Recruitment period">
            {title.requirement.period}
          </Labelled>
        ) : null}
        {title.earned_by === null ? null : held ? (
          <Labelled label="Held by">
            <WikiTextView runs={title.earned_by} />
          </Labelled>
        ) : (
          <p className="m-0 break-words text-ui text-secondary">
            <WikiTextView runs={title.earned_by} />
          </p>
        )}
        {title.reward === null ? null : (
          <Labelled label="Reward">
            {title.reward.name === null ? null : `${title.reward.name}. `}
            <WikiTextView runs={title.reward.text} />
          </Labelled>
        )}
        <Sources title={title} />
      </div>
    </li>
  );
}

function Labelled({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <p className="m-0 break-words text-ui text-secondary">
      <span className="block text-caption text-muted">{label}</span>
      {children}
    </p>
  );
}

/**
 * The guide titles as a grid: one row per track, one column per rank. On a phone each track's
 * titles wrap three to a row and name their rank; on desktop the header row names them.
 */
export function GuideGridView({
  grid,
  iconFor,
}: {
  readonly grid: GuideGrid;
  readonly iconFor: IconLookup;
}) {
  const anyIcon = grid.tracks.some((t) =>
    t.cells.some((c) => c !== null && iconFor(c) !== null),
  );
  return (
    <div className="flex flex-col gap-2">
      <div
        aria-hidden="true"
        className="hidden gap-2 border-b border-hairline pb-2 lg:grid lg:grid-cols-7"
      >
        <span className="lab text-secondary">Track</span>
        {grid.ranks.map((r) => (
          <span key={r.rank} className="flex flex-col text-center">
            <span className="lab text-primary">{r.rank}</span>
            <span className="font-mono text-caption text-secondary">
              {formatNumber(r.sessions)} sessions
            </span>
          </span>
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-4 p-0 lg:gap-2">
        {grid.tracks.map((track) => (
          <li
            key={track.track}
            className="grid grid-cols-3 gap-2 lg:grid-cols-7"
          >
            <p className="col-span-3 m-0 text-heading text-primary lg:col-span-1 lg:self-center">
              {track.track}
            </p>
            {track.cells.map((cell, i) => {
              const rank = grid.ranks[i];
              if (cell === null || rank === undefined) {
                return (
                  <div
                    key={rank?.rank ?? i}
                    aria-hidden="true"
                    className="hidden lg:block"
                  />
                );
              }
              const icon = iconFor(cell);
              // With icons, the desktop header names the rank; without, every cell does.
              const label = anyIcon ? "lg:sr-only" : "";
              return (
                <div
                  key={cell.slug}
                  id={cell.slug}
                  className={`flex flex-col items-center justify-center gap-1 rounded-card bg-surface shadow-soft p-2 text-center ${anchor}`}
                >
                  {icon === null ? null : (
                    <span
                      data-theme="dark"
                      className="flex size-16 items-center justify-center bg-page"
                    >
                      <Icon image={icon} max={48} />
                    </span>
                  )}
                  <span className={`text-caption text-primary ${label}`}>
                    {rank.rank}
                    <span className="sr-only">, {track.track}</span>
                  </span>
                  <span
                    className={`font-mono text-caption text-secondary ${label}`}
                  >
                    {formatNumber(rank.sessions)} sessions
                  </span>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
