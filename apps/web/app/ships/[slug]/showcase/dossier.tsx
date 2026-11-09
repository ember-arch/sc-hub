import type { ReactNode } from "react";
import { TextLink } from "ui";

/**
 * Pieces of the ship entry (ADR-012, ADR-020): a particulars row, a numbered section and the
 * numbered source list.
 */

export interface SheetRow {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
  /** Numbers are set in mono with tabular figures. */
  readonly numeric?: boolean | undefined;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** A numbered section: the number as a label in the accent, the title in the display face. */
export function DossierSection({
  id,
  number,
  title,
  aside,
  children,
}: {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly aside?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t-2 border-primary pt-4">
        <h2
          id={`${id}-title`}
          className="m-0 flex items-baseline gap-3 text-title text-primary"
        >
          <span className="lab text-accent">{pad(number)}</span>
          {title}
        </h2>
        {aside === undefined ? null : (
          <span className="text-caption text-secondary">{aside}</span>
        )}
      </div>
      {children}
    </section>
  );
}

export interface SourceEntry {
  readonly text: string;
  readonly href: string | null;
  readonly note?: string | undefined;
}

export function Sources({
  sources,
}: {
  readonly sources: readonly SourceEntry[];
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {sources.map((source, i) => (
        <li key={source.text} className="flex gap-3 text-ui text-secondary">
          <span className="font-mono text-muted">[{i + 1}]</span>
          <span>
            {source.href === null ? (
              source.text
            ) : (
              <TextLink href={source.href} external className="text-secondary">
                {source.text}
              </TextLink>
            )}
            {source.note === undefined ? null : <span>. {source.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
