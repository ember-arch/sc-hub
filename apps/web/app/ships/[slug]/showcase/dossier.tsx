import type { ReactNode } from "react";
import { Badge, type BadgeTone, type MakerMark, Mark, TextLink } from "ui";
import type { ChapterView, Picture } from "../../../../lib/showcase";
import { AutoVideo } from "./auto-video";

/**
 * The ship dossier (ADR-011): a showcase ship as a reference file, not an advert. A file header with
 * its metadata, the name, the key art as a framed exhibit beside a data sheet; then numbered
 * sections with a contents rail, every image a numbered figure with its source, and the sources
 * listed at the end. Contained in the content width; nothing is full-bleed and no text sits on art.
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

export interface TocEntry {
  readonly id: string;
  readonly title: string;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** The file strip across the top of a dossier or the dossier index: what it is, then its metadata. */
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

export function DossierHeader({
  meta,
  status,
  mark,
  maker,
  role,
  name,
  tagline,
  background,
  cutout,
  figureCredit,
  sheet,
  sheetSource,
  actions,
}: {
  readonly meta: readonly MetaItem[];
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly mark: MakerMark | null;
  readonly maker: { readonly name: string; readonly href: string } | null;
  readonly role: string | null;
  readonly name: string;
  readonly tagline: string | null;
  readonly background: Picture | null;
  readonly cutout: Picture | null;
  readonly figureCredit: {
    readonly text: string;
    readonly href: string;
  } | null;
  readonly sheet: readonly SheetRow[];
  readonly sheetSource: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header aria-labelledby="ship-name" className="flex flex-col gap-8 pt-8">
      <FileStrip
        document="Ship dossier"
        meta={meta}
        end={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            {mark === null ? null : <Mark mark={mark} heightClass="h-12" />}
            <p className="m-0 text-ui text-secondary">
              {maker === null ? null : (
                <TextLink href={maker.href}>{maker.name}</TextLink>
              )}
              {role === null ? null : <> · {role}</>}
            </p>
          </div>
          <h1
            id="ship-name"
            className="showcase-name m-0 text-display text-primary md:text-hero"
          >
            {name}
          </h1>
          {tagline === null ? null : (
            <p className="m-0 text-heading font-regular text-secondary">
              {tagline}
            </p>
          )}
        </div>
        {actions}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <figure className="m-0 flex flex-col gap-2 lg:col-span-8">
          {background === null ? (
            <div className="flex aspect-video items-center justify-center rounded-card border border-hairline bg-inset text-ui text-secondary">
              No art on file
            </div>
          ) : (
            <FramedArt
              background={background}
              cutout={cutout}
              sizes="(min-width: 1024px) 66vw, 100vw"
              priority
            />
          )}
          <figcaption className="flex flex-wrap justify-between gap-2 text-caption text-secondary">
            <span>
              <span className="font-mono text-primary">Fig. A</span> Key art
            </span>
            {figureCredit === null ? null : (
              <TextLink
                href={figureCredit.href}
                external
                className="text-secondary"
              >
                {figureCredit.text}
              </TextLink>
            )}
          </figcaption>
        </figure>

        <section
          aria-label="Particulars"
          className="flex flex-col gap-3 lg:col-span-4"
        >
          <h2 className="m-0 text-ui font-medium text-primary">Particulars</h2>
          <dl className="m-0 flex flex-col border-t border-hairline">
            {sheet.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-hairline py-2"
              >
                <dt className="text-ui text-secondary">{row.label}</dt>
                <dd
                  className={`m-0 text-right text-ui text-primary ${row.numeric === true ? "font-mono" : ""}`}
                >
                  {row.value}
                  {row.unit === undefined ? null : (
                    <span className="font-sans text-caption text-secondary">
                      {" "}
                      {row.unit}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-caption text-secondary">{sheetSource}</p>
        </section>
      </div>
    </header>
  );
}

/** Header and contents rail around the numbered sections. */
export function Dossier({
  header,
  toc,
  children,
}: {
  readonly header: ReactNode;
  readonly toc: readonly TocEntry[];
  readonly children: ReactNode;
}) {
  const contents = (
    <ol className="m-0 flex list-none flex-col p-0">
      {toc.map((entry, i) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="flex gap-3 rounded-control py-1 text-ui text-secondary no-underline transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="font-mono text-muted">{pad(i + 1)}</span>
            {entry.title}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="flex flex-col gap-12">
      {header}
      <details className="rounded-card border border-hairline lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-ui text-primary">
          Contents
        </summary>
        <nav
          aria-label="Dossier contents (compact)"
          className="border-t border-hairline px-4 py-3"
        >
          {contents}
        </nav>
      </details>
      <div className="grid gap-12 lg:grid-cols-12">
        <nav
          aria-label="Dossier contents"
          className="hidden self-start lg:sticky lg:top-6 lg:col-span-3 lg:block"
        >
          <p className="m-0 pb-2 text-caption text-secondary">Contents</p>
          {contents}
        </nav>
        <div className="flex min-w-0 flex-col gap-16 lg:col-span-9">
          {children}
        </div>
      </div>
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

/** A numbered figure: framed image, caption with its number. */
export function Figure({
  label,
  caption,
  picture,
  sizes,
  className,
}: {
  readonly label: string;
  readonly caption: string;
  readonly picture: Picture;
  readonly sizes: string;
  readonly className?: string | undefined;
}) {
  return (
    <figure className={`m-0 flex flex-col gap-2 ${className ?? ""}`}>
      <picture>
        <img
          src={picture.src}
          srcSet={picture.srcSet}
          sizes={sizes}
          width={picture.width}
          height={picture.height}
          alt={picture.alt}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full rounded-card border border-hairline object-cover"
        />
      </picture>
      <figcaption className="text-caption text-secondary">
        <span className="font-mono text-primary">{label}</span> {caption}
      </figcaption>
    </figure>
  );
}

/**
 * The ship's capabilities as CIG's article states them: one entry per chapter, numbered within the
 * section, text beside its figure (a render or a render loop).
 */
export function Capabilities({
  section,
  chapters,
  name,
}: {
  readonly section: number;
  readonly chapters: readonly ChapterView[];
  readonly name: string;
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-12 p-0">
      {chapters.map((chapter, i) => {
        const label = `${section}.${i + 1}`;
        return (
          <li
            key={chapter.heading}
            className="grid gap-6 border-b border-hairline pb-12 last:border-b-0 last:pb-0 md:grid-cols-9"
          >
            <div className="flex flex-col gap-2 md:col-span-4">
              <p className="m-0 flex items-baseline gap-3 text-caption text-secondary">
                <span className="font-mono text-accent">{label}</span>
                {chapter.kicker}
              </p>
              <h3 className="m-0 text-heading text-primary">
                {chapter.heading}
              </h3>
              {chapter.text.map((p) => (
                <p
                  key={p.slice(0, 40)}
                  className="m-0 text-body text-secondary"
                >
                  {p}
                </p>
              ))}
            </div>
            <figure className="m-0 flex flex-col gap-2 md:col-span-5">
              {chapter.video !== null ? (
                <div className="overflow-hidden rounded-card border border-hairline">
                  <AutoVideo
                    src={chapter.video.src}
                    poster={chapter.video.poster ?? chapter.image?.src ?? null}
                    label={`${name}: ${chapter.kicker ?? chapter.heading}, render loop`}
                  />
                </div>
              ) : chapter.image !== null ? (
                <picture>
                  <img
                    src={chapter.image.src}
                    srcSet={chapter.image.srcSet}
                    sizes="(min-width: 1024px) 40vw, (min-width: 768px) 55vw, 100vw"
                    width={chapter.image.width}
                    height={chapter.image.height}
                    alt={chapter.image.alt}
                    loading="lazy"
                    decoding="async"
                    className="block aspect-video h-auto w-full rounded-card border border-hairline object-cover"
                  />
                </picture>
              ) : null}
              {chapter.video === null && chapter.image === null ? null : (
                <figcaption className="text-caption text-secondary">
                  <span className="font-mono text-primary">Fig. {label}</span>{" "}
                  {chapter.kicker ?? chapter.heading}
                  {chapter.video === null ? "" : ", render loop"}
                </figcaption>
              )}
            </figure>
          </li>
        );
      })}
    </ol>
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
