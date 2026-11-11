import { formatTime, withoutEmoji } from "./format";
import { TextLink } from "./text-link";

export interface VideoCardProps {
  /** YouTube's id for the video. */
  readonly id: string;
  readonly title: string;
  /** The channel's name, for example "Squadron 42". */
  readonly channel: string;
  readonly publishedAt: string;
  readonly now: Date;
  /** The video on YouTube. Always visible (docs/legal/obligations.md). */
  readonly url: string;
  /** The player's address; the page's `VideoPlayer` opens it in place when the card is pressed. */
  readonly embed: string;
  /** A YouTube Short: shown with its label; the player opens it upright. */
  readonly short: boolean;
  /** YouTube's own thumbnail, loaded from YouTube's image host (ADR-050). */
  readonly thumbnail: {
    readonly src: string;
    readonly srcSet: string;
    readonly width: number;
    readonly height: number;
  };
  /** `sizes` for the thumbnail: the card's width in the layout it sits in. */
  readonly sizes?: string | undefined;
  /** For a card in the first screen. */
  readonly priority?: boolean | undefined;
}

/**
 * A video as a card (ADR-050): YouTube's thumbnail at 16:9 to the card's edges with "Play" over it
 * (a word, not an icon: ADR-044 keeps icons off the cards), the title without its emoji,
 * then the channel and the time as a label, the title, and the link to YouTube. The thumbnail and
 * the title are links to the video on YouTube, so the card works without script and a middle
 * click opens a new tab; on a page with a `VideoPlayer`, a plain press on either opens the player
 * in place instead (the article's `data-video-embed`), and "Watch on YouTube" always leaves. The same grammar as the dispatch cards: a rounded card by tone and
 * a soft shadow, no scrim, no glow.
 */
export function VideoCard({
  id,
  title,
  channel,
  publishedAt,
  now,
  url,
  embed,
  short,
  thumbnail,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 80vw",
  priority = false,
}: VideoCardProps) {
  const name = withoutEmoji(title);
  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-soft"
      data-video={id}
      data-video-embed={embed}
      data-video-title={name}
      data-video-short={short ? "true" : undefined}
    >
      {/* The title carries the readable link; the thumbnail repeats it for the pointer. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden="true"
        className="group relative block bg-inset"
      >
        <img
          src={thumbnail.src}
          srcSet={thumbnail.srcSet}
          sizes={sizes}
          width={thumbnail.width}
          height={thumbnail.height}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="block aspect-video h-full w-full object-cover"
        />
        {short ? (
          <span className="lab absolute left-3 top-3 rounded-pill bg-page/80 px-2 py-1 text-primary">
            Short
          </span>
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="lab rounded-pill bg-page/80 px-3 py-1 text-primary shadow-soft">
            Play
          </span>
        </span>
      </a>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="lab m-0 flex flex-wrap items-center gap-x-3 text-secondary">
          <span className="text-primary">{channel}</span>
          <time dateTime={publishedAt}>{formatTime(publishedAt, now)}</time>
        </p>
        <h3 className="m-0 line-clamp-3 text-ui font-medium text-primary">
          <TextLink href={url} external className="text-primary">
            {name}
            {/* The thumbnail's label is hidden with the thumbnail; the title says it too. */}
            {short ? <span className="sr-only"> (Short)</span> : null}
          </TextLink>
        </h3>
        {/* Always to YouTube, even where the player would open: the source link (obligations.md). */}
        <p className="m-0 mt-auto pt-1 text-caption" data-video-out="">
          <TextLink
            href={url}
            external
            className="text-secondary"
            ariaLabel={`Watch ${name} on YouTube`}
          >
            Watch on YouTube
          </TextLink>
        </p>
      </div>
    </article>
  );
}
