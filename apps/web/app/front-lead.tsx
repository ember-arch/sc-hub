import { preconnect } from "react-dom";
import type { ContentItem } from "schema";
import { formatTime, withoutEmoji } from "ui";
import { RSI_IMAGE_CREDIT, VIDEO_CREDIT } from "ui/legal";
import { SOURCE_LABEL } from "../lib/dispatches";
import { media } from "../lib/media";
import { channelOf, embedUrl, thumbnailOf } from "../lib/videos";

const pill =
  "rounded-pill px-3 py-1 text-caption font-medium no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/**
 * The front page's lead story outside a show (ADR-058): in place of the daily line and the
 * contents, the story `leadStory` chose, picture first: a Comm-Link's cover or a video's
 * thumbnail at 16:9 beside its label line, its title as the page's title, its excerpt and the
 * links to read it on RSI and, with a video, to play it in place or watch it on YouTube. Without
 * a picture (CI) the words stand on the card alone.
 */
export function FrontLead({
  item,
  video,
  now,
}: {
  readonly item: ContentItem;
  readonly video: ContentItem | null;
  readonly now: Date;
}) {
  const isVideo = item.source === "video";
  const cover = isVideo ? null : media().cover(item.external_id);
  const thumb = isVideo ? thumbnailOf(item.external_id) : null;
  const picture = cover ?? thumb;
  const title = withoutEmoji(item.title);
  // The video the player opens: the lead itself, or the one that rides along with a Comm-Link.
  const playable = isVideo ? item : video;
  if (cover !== null && /^https?:\/\//.test(cover.src)) {
    preconnect(new URL(cover.src).origin);
  }
  const label = isVideo ? channelOf(item) : SOURCE_LABEL[item.source];
  return (
    <section
      aria-labelledby="lead-story"
      // A cover (960 px) takes three fifths; a video's thumbnail (480 px, all YouTube promises,
      // ADR-050) takes half, so it is not drawn much past its own size.
      className={`grid overflow-hidden rounded-card bg-surface shadow-lift ${picture === null ? "" : isVideo ? "md:grid-cols-2" : "md:grid-cols-[3fr_2fr]"}`}
    >
      {picture === null ? null : (
        <span
          className="block bg-inset"
          {...(isVideo
            ? {
                "data-video-embed": embedUrl(item.external_id),
                "data-video-title": title,
              }
            : {})}
        >
          {/* The title carries the readable link; the picture repeats it for the pointer. */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            aria-hidden="true"
            className="relative block h-full"
          >
            <img
              src={picture.src}
              srcSet={picture.srcSet}
              sizes="(min-width: 768px) 60vw, 100vw"
              width={picture.width}
              height={picture.height}
              alt=""
              fetchPriority="high"
              decoding="async"
              referrerPolicy={isVideo ? "no-referrer" : undefined}
              className="block aspect-video h-full w-full object-cover"
            />
            {isVideo ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="lab rounded-pill bg-page/80 px-3 py-1 text-primary shadow-soft">
                  Play
                </span>
              </span>
            ) : null}
          </a>
        </span>
      )}
      <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
        <p className="lab m-0 flex flex-wrap items-center gap-x-3 text-secondary">
          <span className="text-primary">Lead story</span>
          <span>{label}</span>
          <time dateTime={item.published_at}>
            {formatTime(item.published_at, now)}
          </time>
        </p>
        <h1
          id="lead-story"
          className="m-0 text-title text-primary lg:text-display"
        >
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary no-underline hover:text-accent"
          >
            {title}
          </a>
        </h1>
        {item.summary === null || item.summary.trim() === "" ? null : (
          <p className="m-0 line-clamp-4 max-w-prose text-body text-secondary">
            {item.summary}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {isVideo ? null : (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${pill} border border-accent bg-accent-bg text-primary hover:text-accent`}
            >
              Read on RSI
            </a>
          )}
          {playable === null ? null : (
            <span
              data-video-embed={embedUrl(playable.external_id)}
              data-video-title={withoutEmoji(playable.title)}
            >
              <a
                href={playable.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} ${isVideo ? "border border-accent bg-accent-bg text-primary" : "bg-inset text-secondary"} hover:text-accent`}
              >
                Play the video
              </a>
            </span>
          )}
          {playable === null ? null : (
            <span data-video-out="">
              <a
                href={playable.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} bg-inset text-secondary hover:text-accent`}
              >
                Watch on YouTube
              </a>
            </span>
          )}
        </div>
        {picture === null ? null : (
          <p className="m-0 text-caption text-muted">
            {cover === null ? VIDEO_CREDIT.text : RSI_IMAGE_CREDIT.text}
          </p>
        )}
      </div>
    </section>
  );
}
