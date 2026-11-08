import type { ReactNode } from "react";
import { Badge, type BadgeTone, type MakerMark, Mark, TextLink } from "ui";
import type { Fact, ShipClaim } from "../../../lib/ship-file";
import type { FigureView, Picture } from "../../../lib/showcase";
import { CompareLink, CompareToggle } from "../../compare/compare-controls";
import { AutoVideo } from "./showcase/auto-video";
import { DossierSection, type SheetRow } from "./showcase/dossier";
import { HoloViewer } from "./showcase/holo-viewer";

/**
 * The ship file (ADR-012, ADR-014): one template for every ship, concept or flying. It opens on a
 * full-bleed band of the ship's key art with its name, a factual one-line summary and its headline
 * figures. Below, two columns: the left holds the holoviewer model, the particulars and the
 * contents, and stays in view on wide screens; the right holds the same nine numbered sections, in
 * the same order, for every ship. Each section carries the images and render loops that show what
 * it describes, not a gallery. Where the game has no data the section says so, and CIG's stated
 * claims fill in, labelled and cited.
 */

export const SHIP_FILE_SECTIONS = [
  { id: "brief", title: "Brief" },
  { id: "acquisition", title: "Acquisition and status" },
  { id: "operations", title: "Crew and operations" },
  { id: "combat", title: "Combat" },
  { id: "mobility", title: "Mobility" },
  { id: "scale", title: "Scale" },
  { id: "specifications", title: "Specifications" },
  { id: "hardpoints", title: "Hardpoints and loadout" },
  { id: "sources", title: "Sources" },
] as const;

export type ShipFileSection = (typeof SHIP_FILE_SECTIONS)[number]["id"];

export interface ShipFileProps {
  readonly name: string;
  readonly file: string;
  readonly maker: { readonly name: string; readonly href: string } | null;
  readonly role: string | null;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly mark: MakerMark | null;
  /** One factual sentence under the name, composed from the data. */
  readonly dek: string;
  /** The pack slug, for the compare basket; null for a concept ship. */
  readonly compareSlug: string | null;
  readonly visual: {
    readonly model: { readonly src: string; readonly bytes: number } | null;
    readonly poster: string | null;
    readonly length: number | null;
    /** The opening band's key art, with CIG's cut-out of the ship where it publishes one. */
    readonly art: {
      readonly background: Picture;
      readonly cutout: Picture | null;
      readonly credit: { readonly text: string; readonly href: string };
    } | null;
    readonly modelCredit: { readonly text: string; readonly href: string };
  };
  readonly particulars: readonly SheetRow[];
  readonly particularsSource: string;
  /** Each section's images and render loops; the first leads the section. */
  readonly figures: Readonly<
    Partial<Record<ShipFileSection, readonly FigureView[]>>
  >;
  readonly sections: Readonly<
    Record<
      ShipFileSection,
      { readonly aside?: string | undefined; readonly body: ReactNode }
    >
  >;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** The figures the opening band shows, in this order, when the particulars have them. */
const HEADLINE = ["Length", "Crew", "Cargo", "Pledge"] as const;

/** The opening band: key art full-bleed, the name and the headline figures over its lower part. */
export function ShipFileHero({
  name,
  file,
  maker,
  role,
  status,
  mark,
  dek,
  visual,
  particulars,
}: ShipFileProps) {
  const headline = HEADLINE.flatMap((label) => {
    const row = particulars.find((p) => p.label === label);
    return row === undefined || row.numeric !== true ? [] : [row];
  });
  const art = visual.art;
  const text = (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 pb-8 pt-24 md:pb-12">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption">
        <span className="font-mono text-primary">Ship file</span>
        <span className="text-secondary">
          File <span className="font-mono text-primary">{file}</span>
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="flex items-center gap-3">
        {mark === null ? null : <Mark mark={mark} heightClass="h-8" />}
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
      <p className="m-0 max-w-prose text-heading font-regular text-secondary">
        {dek}
      </p>
      {headline.length === 0 ? null : (
        <dl className="m-0 flex flex-wrap gap-x-12 gap-y-4 pt-2">
          {headline.map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <dt className="text-caption text-secondary">{row.label}</dt>
              <dd className="m-0 font-mono text-title text-primary">
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
      )}
    </div>
  );

  if (art === null) {
    return (
      <section aria-labelledby="ship-name" className="border-b border-hairline">
        {text}
      </section>
    );
  }
  return (
    <section
      aria-labelledby="ship-name"
      className="file-hero relative isolate overflow-hidden border-b border-hairline"
    >
      <div aria-hidden="true" className="file-hero-scrim absolute inset-0" />
      <picture>
        <img
          src={art.background.src}
          srcSet={art.background.srcSet}
          sizes="100vw"
          width={art.background.width}
          height={art.background.height}
          alt={art.background.alt}
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      </picture>
      {art.cutout === null ? null : (
        <picture>
          <img
            src={art.cutout.src}
            srcSet={art.cutout.srcSet}
            sizes="(min-width: 768px) 100vw, 170vw"
            width={art.cutout.width}
            height={art.cutout.height}
            alt=""
            fetchPriority="high"
            className="file-hero-cutout absolute -z-10 h-auto"
          />
        </picture>
      )}
      <div aria-hidden="true" className="file-hero-fade absolute inset-0" />
      <div className="flex min-h-[72svh] flex-col justify-end md:min-h-[80svh]">
        {text}
      </div>
      <p className="absolute right-4 top-4 m-0 text-caption text-secondary">
        <TextLink href={art.credit.href} external className="text-secondary">
          {art.credit.text}
        </TextLink>
      </p>
    </section>
  );
}

export function ShipFile({
  name,
  compareSlug,
  visual,
  particulars,
  particularsSource,
  figures,
  sections,
}: ShipFileProps) {
  return (
    <div className="grid gap-12 pt-12 lg:grid-cols-12">
      <aside
        aria-label={`${name}: model and particulars`}
        className="file-aside flex flex-col gap-6 lg:sticky lg:top-6 lg:col-span-5 lg:max-h-[calc(100svh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-2"
      >
        {visual.model === null ? null : (
          <HoloViewer
            src={visual.model.src}
            bytes={visual.model.bytes}
            name={name}
            length={visual.length}
            poster={visual.poster}
            credit={visual.modelCredit}
            label="Fig. A"
          />
        )}

        <section aria-label="Particulars" className="flex flex-col gap-2">
          <p className="m-0 text-caption text-secondary">Particulars</p>
          <dl className="m-0 grid grid-cols-2 gap-x-6 border-t border-hairline">
            {particulars.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 border-b border-hairline py-2"
              >
                <dt className="text-caption text-secondary">{row.label}</dt>
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
          <p className="m-0 text-caption text-secondary">{particularsSource}</p>
        </section>

        {compareSlug === null ? null : (
          <div className="flex flex-wrap gap-2">
            <CompareToggle slug={compareSlug} name={name} />
            <CompareLink />
          </div>
        )}

        <nav
          aria-label="Contents"
          className="flex flex-col gap-1 border-t border-hairline pt-3"
        >
          <p className="m-0 text-caption text-secondary">Contents</p>
          <ol className="m-0 grid list-none grid-cols-2 gap-x-4 p-0">
            {SHIP_FILE_SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex gap-2 rounded-control py-1 text-ui text-secondary no-underline transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="font-mono text-muted">{pad(i + 1)}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col gap-16 lg:col-span-7">
        {SHIP_FILE_SECTIONS.map((s, i) => {
          const own = s.id === "sources" ? [] : (figures[s.id] ?? []);
          const [lead, ...rest] = own;
          return (
            <DossierSection
              key={s.id}
              id={s.id}
              number={i + 1}
              title={s.title}
              aside={sections[s.id].aside}
            >
              {lead === undefined ? null : (
                <LeadFigure figure={lead} label={`Fig. ${i + 1}.1`} />
              )}
              {sections[s.id].body}
              {rest.length === 0 ? null : (
                <SupportingFigures figures={rest} section={i + 1} />
              )}
            </DossierSection>
          );
        })}
      </div>
    </div>
  );
}

function Caption({
  label,
  text,
}: {
  readonly label: string;
  readonly text: string;
}) {
  return (
    <figcaption className="text-caption text-secondary">
      <span className="font-mono text-primary">{label}</span> {text}
    </figcaption>
  );
}

/** The image's own proportions, its phone layout below md where it has one. */
function FigureImage({
  figure,
  sizes,
  fill,
}: {
  readonly figure: Extract<FigureView, { kind: "image" }>;
  readonly sizes: string;
  /** Fill a fixed 16:9 frame (supporting figures) instead of keeping the image's proportions. */
  readonly fill: boolean;
}) {
  const p = figure.picture;
  // Portrait art and plan views are never cut down to a strip; they sit whole in the frame.
  const tall = p.height > p.width * 0.9;
  const fit = fill
    ? `aspect-video h-full w-full ${tall ? "object-contain" : "object-cover"}`
    : "h-auto max-h-[80svh] w-full object-contain";
  return (
    <picture>
      {figure.narrow === null ? null : (
        <source
          media="(max-width: 767px)"
          srcSet={figure.narrow.srcSet}
          sizes="100vw"
          width={figure.narrow.width}
          height={figure.narrow.height}
        />
      )}
      <img
        src={p.src}
        srcSet={p.srcSet}
        sizes={sizes}
        width={p.width}
        height={p.height}
        alt={p.alt}
        loading="lazy"
        decoding="async"
        className={`block ${fit}`}
      />
    </picture>
  );
}

const largest = (p: Picture): string =>
  p.srcSet.split(", ")[0]?.split(" ")[0] ?? p.src;

/** The section's leading image or render loop, across the column at its own proportions. */
function LeadFigure({
  figure,
  label,
}: {
  readonly figure: FigureView;
  readonly label: string;
}) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="overflow-hidden rounded-card border border-hairline bg-inset">
        {figure.kind === "video" ? (
          <AutoVideo
            src={figure.src}
            poster={figure.poster}
            label={figure.caption}
          />
        ) : (
          <FigureImage
            figure={figure}
            sizes="(min-width: 1200px) 680px, (min-width: 1024px) 56vw, 100vw"
            fill={false}
          />
        )}
      </div>
      <Caption label={label} text={figure.caption} />
    </figure>
  );
}

/** The section's other figures, two to a row; an image opens full size in a new tab. */
function SupportingFigures({
  figures,
  section,
}: {
  readonly figures: readonly FigureView[];
  readonly section: number;
}) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {figures.map((figure, i) => {
        const label = `Fig. ${section}.${i + 2}`;
        return (
          <li key={figure.kind === "video" ? figure.src : figure.picture.src}>
            <figure className="m-0 flex flex-col gap-2">
              {figure.kind === "video" ? (
                <div className="overflow-hidden rounded-card border border-hairline bg-inset">
                  <AutoVideo
                    src={figure.src}
                    poster={figure.poster}
                    label={figure.caption}
                  />
                </div>
              ) : (
                <a
                  href={largest(figure.picture)}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-video overflow-hidden rounded-card border border-hairline bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <FigureImage
                    figure={figure}
                    sizes="(min-width: 1024px) 330px, (min-width: 640px) 50vw, 100vw"
                    fill
                  />
                </a>
              )}
              <Caption label={label} text={figure.caption} />
            </figure>
          </li>
        );
      })}
    </ul>
  );
}

/** Label and value pairs in two columns. */
export function Facts({ facts }: { readonly facts: readonly Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="m-0 grid border-t border-hairline sm:grid-cols-2 sm:gap-x-8">
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex items-baseline justify-between gap-4 border-b border-hairline py-2"
        >
          <dt className="text-ui text-secondary">{f.label}</dt>
          <dd
            className={`m-0 text-right text-ui text-primary ${f.numeric === true ? "font-mono" : ""}`}
          >
            {f.value}
            {f.unit === undefined ? null : (
              <span className="font-sans text-caption text-secondary">
                {" "}
                {f.unit}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** CIG's stated claims for a section, cited to the source list by number. */
export function Claims({
  claims,
  cite,
}: {
  readonly claims: readonly ShipClaim[];
  readonly cite: (url: string) => number;
}) {
  if (claims.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-4">
      <p className="m-0 text-caption text-secondary">
        Stated by CIG, not in the game data
      </p>
      <dl className="m-0 flex flex-col">
        {claims.map((c) => (
          <div
            key={c.label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1"
          >
            <dt className="text-ui text-secondary">{c.label}</dt>
            <dd className="m-0 text-ui text-primary">
              {c.value}{" "}
              <span className="font-mono text-caption text-muted">
                [{cite(c.source_url)}]
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A line saying what is missing, in place of a section's data. */
export function Gap({ children }: { readonly children: ReactNode }) {
  return <p className="m-0 text-ui text-secondary">{children}</p>;
}
