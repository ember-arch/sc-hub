import { formatTime } from "./format";
import { TextLink } from "./text-link";

export interface EntityChip {
  readonly name: string;
  readonly href: string;
}

export interface FeedItemProps {
  /** Sentence-case source label, for example "Comm-Link". */
  readonly source: string;
  readonly title: string;
  /** The original on the source site. Always visible (docs/legal/obligations.md). */
  readonly sourceUrl: string;
  readonly publishedAt: string;
  readonly now: Date;
  readonly excerpt: string | null;
  readonly entities: readonly EntityChip[];
}

export function FeedItem({
  source,
  title,
  sourceUrl,
  publishedAt,
  now,
  excerpt,
  entities,
}: FeedItemProps) {
  return (
    <article className="flex flex-col gap-2 border-b border-hairline py-4">
      {/* The dispatch line (ADR-020): the source and the time as a label. */}
      <p className="lab m-0 flex flex-wrap items-center gap-x-3 text-secondary">
        <span className="text-primary">{source}</span>
        <time dateTime={publishedAt}>{formatTime(publishedAt, now)}</time>
      </p>
      <h3 className="text-heading text-primary">
        <TextLink href={sourceUrl} external className="text-primary">
          {title}
        </TextLink>
      </h3>
      {excerpt !== null && excerpt !== "" ? (
        <p className="max-w-prose text-body text-secondary">{excerpt}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <TextLink href={sourceUrl} external>
          Read on the source site
        </TextLink>
        {entities.map((entity) => (
          <TextLink
            key={entity.href}
            href={entity.href}
            className="rounded-control border border-hairline bg-inset px-2 py-1 text-secondary no-underline hover:text-primary"
          >
            {entity.name}
          </TextLink>
        ))}
      </div>
    </article>
  );
}
