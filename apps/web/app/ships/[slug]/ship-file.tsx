import type { ReactNode } from "react";
import NextLink from "next/link";
import {
  Badge,
  type BadgeTone,
  type MakerMark,
  Mark,
  TextLink,
  sentence,
} from "ui";
import type { Fact, ShipClaim } from "../../../lib/ship-file";
import type { FigureView, Picture } from "../../../lib/showcase";
import { CompareLink, CompareToggle } from "../../compare/compare-controls";
import { AutoVideo } from "./showcase/auto-video";
import { DossierSection, type SheetRow } from "./showcase/dossier";
import { HoloViewer } from "./showcase/holo-viewer";

/**
 * The ship entry (ADR-012, ADR-014, ADR-020): one template for every ship, concept or flying. It
 * opens on the holomodel drawn in ink beside the ship's name, a factual one-line summary and the
 * particulars as a ruled table, with the key art as a plate under them. Below, the contents stay
 * in view on wide screens beside the same nine numbered sections, in the same order, for every
 * ship. Each section carries the images and render loops that show what it describes as captioned
 * plates, not a gallery. Where the game has no data the section says so, and CIG's stated claims
 * fill in, labelled and cited.
 */

export const SHIP_FILE_SECTIONS = [
  { id: "brief", title: "Brief" },
  { id: "acquisition", title: "Acquisition and status" },
  { id: "combat", title: "Weapons and combat" },
  { id: "operations", title: "Crew and operations" },
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
    /** RSI's holoviewer model (ADR-015) and the person RSI stands beside it for scale. */
    readonly model: {
      readonly src: string;
      readonly bytes: number;
      readonly figure: { readonly src: string; readonly height: number } | null;
    } | null;
    readonly poster: string | null;
    readonly length: number | null;
    /** The key art as the cover (ADR-021), with CIG's cut-out of the ship laid over it where it publishes one. */
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

/**
 * The opening (ADR-021): the key art as the cover, full width and rounded, with the entry's head,
 * name and status over its lower part on a scrim and the credit in a pill at the top right; then
 * the holomodel in ink and the particulars in two rounded panels. Without art the head stands on
 * the page; without a model the particulars panel stands alone. It renders in the shell's
 * full-bleed stage slot.
 */
export function ShipFileOpening({
  name,
  file,
  maker,
  role,
  status,
  mark,
  dek,
  compareSlug,
  visual,
  particulars,
  particularsSource,
}: ShipFileProps) {
  const art = visual.art;
  const pill =
    "rounded-pill px-3 py-1 text-caption font-medium no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const onArt = `${pill} bg-on-art/15 text-on-art`;
  const onPage = `${pill} bg-inset text-secondary`;
  const pills = (overArt: boolean): ReactNode => (
    <>
      {/* The status keeps its semantic tone on its own fill, over art or not: the accent is for links and selection, and a tinted pill fails contrast in dark. */}
      <Badge tone={status.tone}>{status.label}</Badge>
      {maker === null ? null : (
        <NextLink
          href={maker.href}
          className={`${overArt ? onArt : onPage} hover:text-accent`}
        >
          {maker.name}
        </NextLink>
      )}
      {role === null ? null : (
        <span className={overArt ? onArt : onPage}>{sentence(role)}</span>
      )}
    </>
  );
  return (
    <section
      aria-labelledby="ship-name"
      className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pb-8 pt-4"
    >
      {art === null ? (
        <div className="flex flex-col gap-4 pt-4">
          <p className="lab m-0 text-muted">Entry {file}</p>
          <h1
            id="ship-name"
            className="m-0 text-display text-primary lg:text-hero"
          >
            {name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {pills(false)}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-card bg-inset shadow-lift">
          <img
            src={art.background.src}
            srcSet={art.background.srcSet}
            sizes="100vw"
            width={art.background.width}
            height={art.background.height}
            alt={art.background.alt}
            fetchPriority="high"
            decoding="async"
            className="block aspect-[4/5] h-auto w-full object-cover md:aspect-[21/9]"
          />
          {art.cutout === null ? null : (
            // CIG's cut-out of the ship over its key background, the whole ship in frame: it sits
            // in the band above the name (the title block is under 96 px tall), scaled to fit, to
            // the right on wide screens as RSI composes its own page. Spacing from the scale only.
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center px-6 pb-24 pt-12 md:justify-end md:px-12 md:pb-24 md:pt-8"
            >
              <img
                src={art.cutout.src}
                srcSet={art.cutout.srcSet}
                sizes="(min-width: 768px) 75vw, 90vw"
                width={art.cutout.width}
                height={art.cutout.height}
                alt=""
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          <div aria-hidden="true" className="art-scrim absolute inset-0" />
          <div className="absolute inset-x-4 top-4 flex flex-wrap items-center gap-2 md:inset-x-8 md:top-6">
            {pills(true)}
            {/* The credit sits at the row's end; on a phone it wraps under the pills rather than over them. */}
            <a
              href={art.credit.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${onArt} md:ml-auto`}
            >
              {art.credit.text}
            </a>
          </div>
          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2 md:inset-x-8 md:bottom-8">
            <p className="lab m-0 text-on-art/80">Entry {file}</p>
            <h1
              id="ship-name"
              className="m-0 text-display text-on-art lg:text-hero"
            >
              {name}
            </h1>
          </div>
        </div>
      )}
      <div
        className={`grid gap-6 ${visual.model === null ? "" : "lg:grid-cols-[5fr_4fr]"}`}
      >
        {visual.model === null ? null : (
          <div className="overflow-hidden rounded-card bg-surface p-4 shadow-soft">
            <HoloViewer
              src={visual.model.src}
              bytes={visual.model.bytes}
              figure={visual.model.figure}
              name={name}
              length={visual.length}
              poster={visual.poster}
              credit={visual.modelCredit}
              label="Fig. A"
            />
          </div>
        )}
        <div className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-soft">
          {mark === null ? null : <Mark mark={mark} heightClass="h-8" />}
          <p className="m-0 max-w-prose text-heading font-regular text-secondary">
            {dek}
          </p>
          <SpecTable rows={particulars} source={particularsSource} />
          {compareSlug === null ? null : (
            <div className="flex flex-wrap gap-2">
              <CompareToggle slug={compareSlug} name={name} />
              <CompareLink />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** The particulars as a ruled table: labels left, figures in the mono, a 2 px rule to close. */
function SpecTable({
  rows,
  source,
}: {
  readonly rows: readonly SheetRow[];
  readonly source: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <table className="w-full border-collapse border-b border-hairline text-ui">
        <caption className="sr-only">Particulars</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-hairline">
              <th
                scope="row"
                className="w-2/5 py-2 pr-4 text-left font-regular text-secondary"
              >
                {row.label}
              </th>
              <td
                className={`py-2 text-primary ${row.numeric === true ? "font-mono" : ""}`}
              >
                {row.value}
                {row.unit === undefined ? null : (
                  <span className="font-sans text-caption text-secondary">
                    {" "}
                    {row.unit}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 text-caption text-secondary">{source}</p>
    </div>
  );
}

export function ShipFile({ figures, sections }: ShipFileProps) {
  return (
    <div className="grid gap-12 pt-12 lg:grid-cols-12">
      <nav
        aria-label="Contents"
        className="flex flex-col gap-2 lg:sticky lg:top-6 lg:col-span-3 lg:self-start"
      >
        <p className="lab m-0 text-secondary">Contents</p>
        <ol className="m-0 flex list-none flex-col p-0">
          {SHIP_FILE_SECTIONS.map((s, i) => (
            <li key={s.id} className="border-t border-hairline">
              <a
                href={`#${s.id}`}
                className="flex items-baseline gap-3 rounded-control py-2 text-ui text-primary no-underline transition-colors duration-hover hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="lab w-6 shrink-0 text-muted">
                  {pad(i + 1)}
                </span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-col gap-16 lg:col-span-9">
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

/** A plate's caption, inside its frame: the figure number as a label, then the words. */
function Caption({
  label,
  text,
}: {
  readonly label: string;
  readonly text: string;
}) {
  return (
    <figcaption className="border-t border-hairline bg-surface px-3 py-2 text-caption text-secondary">
      <span className="lab text-primary">{label}</span> {text}
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

/** The section's leading image or render loop as a plate across the column, at its own proportions. */
function LeadFigure({
  figure,
  label,
}: {
  readonly figure: FigureView;
  readonly label: string;
}) {
  return (
    <figure className="m-0 flex flex-col overflow-hidden rounded-card bg-inset">
      {figure.kind === "video" ? (
        <AutoVideo
          src={figure.src}
          poster={figure.poster}
          label={figure.caption}
          width={figure.width}
          height={figure.height}
        />
      ) : (
        <FigureImage
          figure={figure}
          sizes="(min-width: 1400px) 1000px, (min-width: 1024px) 70vw, 100vw"
          fill={false}
        />
      )}
      <Caption label={label} text={figure.caption} />
    </figure>
  );
}

/** The section's other figures as plates, two to a row; an image opens full size in a new tab. */
function SupportingFigures({
  figures,
  section,
}: {
  readonly figures: readonly FigureView[];
  readonly section: number;
}) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
      {figures.map((figure, i) => {
        const label = `Fig. ${section}.${i + 2}`;
        return (
          <li key={figure.kind === "video" ? figure.src : figure.picture.src}>
            <figure className="m-0 flex h-full flex-col overflow-hidden rounded-card bg-inset">
              {figure.kind === "video" ? (
                <AutoVideo
                  src={figure.src}
                  poster={figure.poster}
                  label={figure.caption}
                  width={figure.width}
                  height={figure.height}
                />
              ) : (
                <a
                  href={largest(figure.picture)}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-video overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <FigureImage
                    figure={figure}
                    sizes="(min-width: 1400px) 500px, (min-width: 640px) 45vw, 100vw"
                    fill
                  />
                </a>
              )}
              <div className="mt-auto">
                <Caption label={label} text={figure.caption} />
              </div>
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
            {f.links === undefined || f.links.length === 0
              ? f.value
              : f.links.map((l, i) => (
                  <span key={l.href}>
                    {i > 0 ? ", " : null}
                    <TextLink href={l.href}>{l.label}</TextLink>
                  </span>
                ))}
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
    <div className="flex flex-col gap-2 rounded-card bg-surface shadow-soft p-4">
      <p className="lab m-0 text-secondary">
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

/**
 * Related ships (spec 02, "Ship page"): the maker's other ships and the ships with the same role,
 * linked, at the foot of the file beside its sources.
 */
export function Related({
  groups,
}: {
  readonly groups: readonly {
    readonly title: string;
    readonly ships: readonly { readonly name: string; readonly href: string }[];
  }[];
}) {
  const shown = groups.filter((g) => g.ships.length > 0);
  if (shown.length === 0) return null;
  return (
    <nav aria-label="Related ships" className="flex flex-col gap-2">
      <h3 className="lab m-0 text-primary">Related ships</h3>
      <dl className="m-0 flex flex-col border-t border-hairline">
        {shown.map((g) => (
          <div
            key={g.title}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline py-2"
          >
            <dt className="text-ui text-secondary">{g.title}</dt>
            <dd className="m-0 text-ui">
              {g.ships.map((s, i) => (
                <span key={s.href}>
                  {i > 0 ? ", " : null}
                  <TextLink href={s.href}>{s.name}</TextLink>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </nav>
  );
}

/** A line saying what is missing, in place of a section's data. */
export function Gap({ children }: { readonly children: ReactNode }) {
  return <p className="m-0 text-ui text-secondary">{children}</p>;
}
