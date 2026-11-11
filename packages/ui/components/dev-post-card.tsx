import { formatTime } from "./format";
import { TextLink } from "./text-link";

export interface DevPostCardProps {
  /** The thread's title: what the post is about, as Spectrum names it. */
  readonly title: string;
  readonly author: {
    readonly name: string;
    readonly role: string | null;
    readonly href?: string | undefined;
  };
  readonly publishedAt: string;
  readonly now: Date;
  /** The post's first lines as plain text; null when the post is empty. */
  readonly excerpt: string | null;
  /** The Spectrum post. Always visible (docs/legal/obligations.md). */
  readonly sourceUrl: string;
  /** The thread on Spectrum, when it is not the post itself. */
  readonly threadUrl?: string | undefined;
}

/**
 * A developer post as a small card for a rail (ADR-050): the same marks as `DevPost` (Spectrum's
 * yellow down the left edge, the ring of the role tag) with the thread's title, the author, the
 * time and the post's first lines, and the links to the post and its thread under it. It does not
 * open in place: the whole post is on Spectrum and on the developer posts page, where `DevPost`
 * unfolds it across the page's width.
 */
export function DevPostCard({
  title,
  author,
  publishedAt,
  now,
  excerpt,
  sourceUrl,
  threadUrl,
}: DevPostCardProps) {
  return (
    <article className="flex h-full flex-col rounded-card border-l-[3px] border-spectrum-staff bg-surface shadow-soft">
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="lab m-0 text-secondary">
          <time dateTime={publishedAt}>{formatTime(publishedAt, now)}</time>
        </p>
        <h3 className="m-0 line-clamp-2 text-ui font-medium text-primary">
          <TextLink href={sourceUrl} external className="text-primary">
            {title}
          </TextLink>
        </h3>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption">
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
        {excerpt !== null ? (
          <p className="m-0 line-clamp-4 text-ui text-secondary [overflow-wrap:anywhere]">
            {excerpt}
          </p>
        ) : null}
      </div>
      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline px-4 py-3 text-caption">
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
