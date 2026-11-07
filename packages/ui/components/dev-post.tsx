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

export function DevPost({
  author,
  thread,
  publishedAt,
  now,
  bodyHtml,
  sourceUrl,
}: DevPostProps) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2 text-ui">
          {author.href !== undefined ? (
            <TextLink href={author.href} className="font-medium text-primary">
              {author.name}
            </TextLink>
          ) : (
            <span className="font-medium text-primary">{author.name}</span>
          )}
          {author.role !== null ? (
            <span className="text-secondary">{author.role}</span>
          ) : null}
          {thread !== null ? (
            <span className="text-muted">in {thread}</span>
          ) : null}
        </div>
        <time dateTime={publishedAt} className="text-caption text-muted">
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
