import { formatTime } from "./format";
import { TextLink } from "./text-link";

export interface DevPostProps {
  /** The thread's title: what the post is about, as Spectrum names it. */
  readonly title: string;
  readonly author: {
    readonly name: string;
    readonly role: string | null;
    readonly href?: string | undefined;
  };
  readonly publishedAt: string;
  readonly now: Date;
  /** Sanitized upstream (ContentItem.body_html); quotes and formatting preserved. */
  readonly bodyHtml: string;
  /** The post's first lines as plain text, shown while the card is folded; null when the post is empty. */
  readonly excerpt: string | null;
  /** The Spectrum post. Always visible, never collapsible (docs/legal/obligations.md). */
  readonly sourceUrl: string;
  /** The thread on Spectrum, when it is not the post itself. */
  readonly threadUrl?: string | undefined;
  /** Open on arrival; folded by default (ADR-035). */
  readonly open?: boolean | undefined;
}

/**
 * A developer post (ADR-032, ADR-035): a card with Spectrum's own yellow as its mark, the rule
 * down its left edge and the ring of the role tag, folded by default to the thread's title, the
 * author, the time and the post's first lines, and opened with a tap to the whole post across
 * the card's width. The links to the post and its thread stand under the card's fold and are
 * always visible (obligations.md). The yellow is never text on the light wall (1.75:1); it marks.
 */
export function DevPost({
  title,
  author,
  publishedAt,
  now,
  bodyHtml,
  excerpt,
  sourceUrl,
  threadUrl,
  open = false,
}: DevPostProps) {
  return (
    <article className="rounded-card border-l-[3px] border-spectrum-staff bg-surface shadow-soft">
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 [&::-webkit-details-marker]:hidden md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="m-0 text-heading text-primary">{title}</h3>
            <time
              dateTime={publishedAt}
              className="text-caption text-secondary"
            >
              {formatTime(publishedAt, now)}
            </time>
          </div>
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ui">
            {author.href !== undefined ? (
              <TextLink href={author.href} className="font-medium text-primary">
                {author.name}
              </TextLink>
            ) : (
              <span className="font-medium text-primary">{author.name}</span>
            )}
            {author.role !== null ? (
              <span className="lab rounded-pill border border-spectrum-staff px-2 text-primary">
                {author.role}
              </span>
            ) : null}
          </p>
          {excerpt !== null && excerpt !== "" ? (
            <p className="m-0 line-clamp-3 text-body text-secondary [overflow-wrap:anywhere] group-open:hidden">
              {excerpt}
            </p>
          ) : null}
          <p className="m-0 text-caption text-accent">
            <span className="group-open:hidden">Show the whole post</span>
            <span className="hidden group-open:inline">Fold the post</span>
          </p>
        </summary>
        <div
          className="dev-post-body px-4 pb-2 text-body text-primary md:px-6"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </details>
      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline px-4 py-3 text-caption md:px-6">
        <TextLink href={sourceUrl} external>
          View on Spectrum
        </TextLink>
        {threadUrl !== undefined && threadUrl !== sourceUrl ? (
          <TextLink href={threadUrl} external className="text-secondary">
            The thread
          </TextLink>
        ) : null}
      </footer>
    </article>
  );
}
