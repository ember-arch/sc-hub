import type { ReactNode } from "react";
import { Badge, type BadgeTone, type MakerMark, Mark, TextLink } from "ui";
import type { Fact, ShipClaim } from "../../../lib/ship-file";
import type { Picture } from "../../../lib/showcase";
import { CompareLink, CompareToggle } from "../../compare/compare-controls";
import { AutoVideo } from "./showcase/auto-video";
import {
  DossierSection,
  FileStrip,
  FramedArt,
  type SheetRow,
} from "./showcase/dossier";
import { HoloViewer } from "./showcase/holo-viewer";

/**
 * The ship file (ADR-012): one template for every ship, concept or flying, in two columns. The
 * left column holds who the ship is: file strip, name, the holoviewer model (or its art), its
 * particulars and the contents; it stays in view on wide screens. The right column holds the same
 * ten numbered sections, in the same order, for every ship. Where the game has no data the section
 * says so, and CIG's stated claims fill in, labelled and cited.
 */

export const SHIP_FILE_SECTIONS = [
  { id: "brief", title: "Brief" },
  { id: "acquisition", title: "Acquisition and status" },
  { id: "operations", title: "Crew and operations" },
  { id: "combat", title: "Combat" },
  { id: "mobility", title: "Mobility" },
  { id: "scale", title: "Scale" },
  { id: "imagery", title: "Imagery" },
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
  /** The pack slug, for the compare basket; null for a concept ship. */
  readonly compareSlug: string | null;
  readonly visual: {
    readonly model: { readonly src: string; readonly bytes: number } | null;
    readonly poster: string | null;
    readonly length: number | null;
    readonly art: {
      readonly background: Picture;
      readonly cutout: Picture | null;
    } | null;
    readonly modelCredit: { readonly text: string; readonly href: string };
  };
  readonly particulars: readonly SheetRow[];
  readonly particularsSource: string;
  readonly sections: Readonly<
    Record<
      ShipFileSection,
      { readonly aside?: string | undefined; readonly body: ReactNode }
    >
  >;
}

const pad = (n: number): string => String(n).padStart(2, "0");

export function ShipFile({
  name,
  file,
  maker,
  role,
  status,
  mark,
  compareSlug,
  visual,
  particulars,
  particularsSource,
  sections,
}: ShipFileProps) {
  return (
    <div className="grid gap-10 pt-8 lg:grid-cols-12">
      <aside
        aria-label={`${name}: identity and particulars`}
        className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-5 lg:max-h-[calc(100svh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-2"
      >
        <FileStrip
          document="Ship file"
          meta={[{ label: "File", value: file }]}
          end={<Badge tone={status.tone}>{status.label}</Badge>}
        />
        <div className="flex flex-col gap-2">
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
            className="showcase-name m-0 text-display text-primary"
          >
            {name}
          </h1>
        </div>

        {visual.model !== null ? (
          <HoloViewer
            src={visual.model.src}
            bytes={visual.model.bytes}
            name={name}
            length={visual.length}
            poster={visual.poster}
            credit={visual.modelCredit}
            label="Fig. A"
          />
        ) : visual.art !== null ? (
          <figure className="m-0 flex flex-col gap-2">
            <FramedArt
              background={visual.art.background}
              cutout={visual.art.cutout}
              sizes="(min-width: 1024px) 40vw, 100vw"
              priority
            />
            <figcaption className="text-caption text-secondary">
              <span className="font-mono text-primary">Fig. A</span> Official
              image; no holoviewer model on file
            </figcaption>
          </figure>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-card border border-hairline bg-inset text-ui text-secondary">
            No model or image on file
          </div>
        )}

        <section aria-label="Particulars" className="flex flex-col gap-2">
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

      <div className="flex min-w-0 flex-col gap-14 lg:col-span-7">
        {SHIP_FILE_SECTIONS.map((s, i) => (
          <DossierSection
            key={s.id}
            id={s.id}
            number={i + 1}
            title={s.title}
            aside={sections[s.id].aside}
          >
            {sections[s.id].body}
          </DossierSection>
        ))}
      </div>
    </div>
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

/** Every image and render loop on file for the ship, each a numbered figure. */
export function MediaWall({
  section,
  videos,
  images,
}: {
  readonly section: number;
  readonly videos: readonly {
    readonly src: string;
    readonly poster: string | null;
    readonly caption: string;
  }[];
  readonly images: readonly {
    readonly picture: Picture;
    readonly caption: string;
  }[];
}) {
  let n = 0;
  const label = (): string => `Fig. ${section}.${++n}`;
  const largest = (p: Picture): string =>
    p.srcSet.split(", ")[0]?.split(" ")[0] ?? p.src;
  return (
    <div className="flex flex-col gap-6">
      {videos.length === 0 ? null : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {videos.map((v) => (
            <li key={v.src}>
              <figure className="m-0 flex flex-col gap-2">
                <div className="overflow-hidden rounded-card border border-hairline">
                  <AutoVideo src={v.src} poster={v.poster} label={v.caption} />
                </div>
                <figcaption className="text-caption text-secondary">
                  <span className="font-mono text-primary">{label()}</span>{" "}
                  {v.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
      {images.length === 0 ? null : (
        <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.picture.src}>
              <figure className="m-0 flex flex-col gap-2">
                <a
                  href={largest(img.picture)}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-card border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <img
                    src={img.picture.src}
                    srcSet={img.picture.srcSet}
                    sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 50vw"
                    width={img.picture.width}
                    height={img.picture.height}
                    alt={img.picture.alt}
                    loading="lazy"
                    decoding="async"
                    className="block aspect-video h-auto w-full object-cover"
                  />
                </a>
                <figcaption className="text-caption text-secondary">
                  <span className="font-mono text-primary">{label()}</span>{" "}
                  {img.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
      {videos.length === 0 && images.length === 0 ? (
        <Gap>No images on file for this ship yet.</Gap>
      ) : null}
    </div>
  );
}
