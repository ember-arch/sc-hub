import { formatTime } from "./format";
import type { ResponsiveImage } from "./media";
import { TextLink } from "./text-link";

export type DispatchPicture = Pick<
  ResponsiveImage,
  "src" | "srcSet" | "width" | "height"
>;

export interface DispatchCardProps {
  /** Sentence-case source label, for example "Comm-Link". */
  readonly source: string;
  readonly title: string;
  /** The original on the source site. Always visible (docs/legal/obligations.md). */
  readonly sourceUrl: string;
  readonly publishedAt: string;
  readonly now: Date;
  /** The source's own first paragraph or blurb; never generated. */
  readonly excerpt: string | null;
  /**
   * The cover RSI's hub shows for the dispatch (ADR-029); null on a clone without media, when the
   * card is its words alone. The card shows no credit: the page credits the covers once below.
   */
  readonly picture: DispatchPicture | null;
  /** The page's newest dispatch: the cover beside the words from 768 px, and the lift shadow. */
  readonly lead?: boolean | undefined;
  /** For the lead on the first page, usually the page's largest paint. */
  readonly priority?: boolean | undefined;
}

/**
 * A dispatch as a card (ADR-029): the cover at 16:9 to the card's edges, then the dispatch line
 * (source, time), the title, the excerpt cut to three lines (four on the lead, which has the
 * height of its cover beside it) and the source link. The same
 * grammar as the register's cards (ADR-021): a rounded card by tone and a soft shadow, the
 * words in their own block, no scrim.
 */
export function DispatchCard({
  source,
  title,
  sourceUrl,
  publishedAt,
  now,
  excerpt,
  picture,
  lead = false,
  priority = false,
}: DispatchCardProps) {
  const image =
    picture === null ? null : (
      // The title carries the readable link; the picture repeats it for the pointer. Inside
      // <picture> React adds no preload hint, so a page linking here prefetches no covers.
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden="true"
        className="block"
      >
        <picture>
          <img
            src={picture.src}
            srcSet={picture.srcSet}
            sizes={
              lead
                ? "(min-width: 768px) 58vw, 100vw"
                : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            }
            width={picture.width}
            height={picture.height}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className="block aspect-video h-full w-full object-cover"
          />
        </picture>
      </a>
    );
  return (
    <article
      className={`overflow-hidden rounded-card bg-surface shadow-soft ${lead ? "md:grid md:grid-cols-12" : "flex h-full flex-col"}`}
    >
      {image === null ? null : (
        <div className={lead ? "md:col-span-7" : ""}>{image}</div>
      )}
      <div
        className={`flex flex-col gap-2 ${lead ? `justify-center p-4 md:p-6 ${image === null ? "md:col-span-12" : "md:col-span-5"}` : "flex-1 p-4"}`}
      >
        {/* The dispatch line (ADR-020): the source and the time as a label. */}
        <p className="lab m-0 flex flex-wrap items-center gap-x-3 text-secondary">
          <span className="text-primary">{source}</span>
          <time dateTime={publishedAt}>{formatTime(publishedAt, now)}</time>
        </p>
        <h3 className="m-0 text-heading text-primary">
          <TextLink href={sourceUrl} external className="text-primary">
            {title}
          </TextLink>
        </h3>
        {excerpt !== null && excerpt !== "" ? (
          <p
            className={`m-0 max-w-prose text-body text-secondary [overflow-wrap:anywhere] ${lead ? "line-clamp-4" : "line-clamp-3"}`}
          >
            {excerpt}
          </p>
        ) : null}
        <p className="m-0 mt-auto pt-2 text-caption">
          <TextLink href={sourceUrl} external>
            Read on the source site
          </TextLink>
        </p>
      </div>
    </article>
  );
}
