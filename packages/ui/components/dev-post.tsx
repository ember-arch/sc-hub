import { formatTime } from "./format";
import { TextLink } from "./text-link";

export interface DevPostProps {
  readonly author: {
    readonly name: string;
    readonly role: string | null;
    readonly href?: string | undefined;
  };
  readonly thread: string | null;
  readonly publishedAt: string;
  readonly now: Date;
  /** Sanitized upstream (ContentItem.body_html); quotes and formatting preserved. */
  readonly bodyHtml: string;
  /** The Spectrum post. Always visible, never collapsible (docs/legal/obligations.md). */
  readonly sourceUrl: string;
}

/**
 * A developer post (ADR-032): a card with Spectrum's own yellow as its mark, the rule down its
 * left edge and the ring of the role tag, as Spectrum itself marks a staff post; the author's
 * name first (a link to the author page, underlined like every link, ADR-005), the role, the
 * thread, the time at the right; the post in full as prose; the source link last. The yellow is
 * never text on the light wall (1.75:1); it marks.
 */
export function DevPost({
  author,
  thread,
  publishedAt,
  now,
  bodyHtml,
  sourceUrl,
}: DevPostProps) {
  return (
    <article className="flex flex-col gap-3 rounded-card border-l-[3px] border-spectrum-staff bg-surface p-4 shadow-soft md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ui">
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
          {thread !== null ? (
            <span className="text-secondary">in {thread}</span>
          ) : null}
        </div>
        <time dateTime={publishedAt} className="text-caption text-secondary">
          {formatTime(publishedAt, now)}
        </time>
      </header>
      <div
        className="dev-post-body max-w-prose text-body text-primary"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      <footer className="text-caption">
        <TextLink href={sourceUrl} external>
          View on Spectrum
        </TextLink>
      </footer>
    </article>
  );
}
