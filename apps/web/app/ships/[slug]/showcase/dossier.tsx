import type { ReactNode } from "react";
import { TextLink } from "ui";
import type { Picture } from "../../../../lib/showcase";

/**
 * Pieces shared by the ship file (ADR-012) and the dossier index on the home page (ADR-011): the
 * file strip, framed key art, a numbered section and the numbered source list.
 */

export interface MetaItem {
  readonly label: string;
  readonly value: string;
}

export interface SheetRow {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
  /** Numbers are set in mono with tabular figures. */
  readonly numeric?: boolean | undefined;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** The strip across the top of a file or the index: what it is, then its metadata. */
export function FileStrip({
  document,
  meta,
  end,
}: {
  readonly document: string;
  readonly meta: readonly MetaItem[];
  readonly end?: ReactNode;
}) {
  return (
    <dl className="m-0 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-hairline py-3 text-caption">
      <div className="flex items-center gap-2">
        <dt className="sr-only">Document</dt>
        <dd className="m-0 font-mono text-primary">{document}</dd>
      </div>
      {meta.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <dt className="text-secondary">{item.label}</dt>
          <dd className="m-0 font-mono text-primary">{item.value}</dd>
        </div>
      ))}
      {end === undefined ? null : <div className="ml-auto">{end}</div>}
    </dl>
  );
}

/** Key art in a frame, with the transparent cut-out layered over it where CIG made one. */
export function FramedArt({
  background,
  cutout,
  sizes,
  priority,
}: {
  readonly background: Picture;
  readonly cutout: Picture | null;
  readonly sizes: string;
  readonly priority: boolean;
}) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-card border border-hairline bg-inset">
      <picture>
        <img
          src={background.src}
          srcSet={background.srcSet}
          sizes={sizes}
          width={background.width}
          height={background.height}
          alt={background.alt}
          fetchPriority={priority ? "high" : undefined}
          loading={priority ? undefined : "lazy"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      {cutout === null ? null : (
        <picture>
          <img
            src={cutout.src}
            srcSet={cutout.srcSet}
            sizes={sizes}
            width={cutout.width}
            height={cutout.height}
            alt=""
            fetchPriority={priority ? "high" : undefined}
            loading={priority ? undefined : "lazy"}
            className="dossier-cutout absolute h-auto"
          />
        </picture>
      )}
    </div>
  );
}

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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline-strong pt-4">
        <h2
          id={`${id}-title`}
          className="m-0 flex items-baseline gap-3 text-title text-primary"
        >
          <span className="font-mono text-ui text-accent">{pad(number)}</span>
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
