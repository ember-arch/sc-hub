import NextLink from "next/link";
import type { ReactNode } from "react";
import type { PlatePicture } from "ui";
import { RSI_IMAGE_CREDIT } from "ui/legal";
import { CONTENTS } from "../lib/front";
import { type Figure, FigureStrip } from "./strip";

export type Counter = Figure;

/** The front page's counters: the figure strip, every figure a link. */
export function Counters({
  counters,
}: {
  readonly counters: readonly Counter[];
}) {
  return <FigureStrip figures={counters} />;
}

/**
 * The front page's parts (ADR-020, ADR-021, ADR-038): the contents list, the counters (the figure
 * strip), the bento, the register link and the running heads. Pure presentation; page.tsx reads
 * the data and hands it in.
 */

const link =
  "no-underline transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/** The sections of the almanac, numbered, in two columns on wide screens. */
export function Contents() {
  return (
    <nav aria-labelledby="contents" className="flex flex-col gap-2">
      <p id="contents" className="lab m-0 text-secondary">
        Contents
      </p>
      <ol className="m-0 list-none p-0 text-ui md:columns-2 md:gap-x-8">
        {CONTENTS.map((entry) => (
          <li
            key={entry.href}
            className="flex break-inside-avoid items-baseline gap-3 border-t border-hairline py-2"
          >
            <span className="lab w-6 shrink-0 text-muted">{entry.number}</span>
            <NextLink
              href={entry.href}
              className={`${link} text-primary hover:text-accent`}
            >
              {entry.label}
            </NextLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface PlateEntry {
  readonly slug: string;
  readonly name: string;
  readonly maker: string;
  /** The role or focus, and the plate's reason: "heavy gunship · the live example". */
  readonly note: string;
  readonly picture: PlatePicture | null;
}

/**
 * The front page's bento (ADR-021, ADR-038): the live example large, the concept hero tall beside
 * it, then three more across that change daily; each an image card with the ship's name over a scrim. Without a picture a
 * card is a toned panel with the name, so the layout keeps its shape on CI and a deployment.
 */
export function Bento({ cards }: { readonly cards: readonly PlateEntry[] }) {
  if (cards.length === 0) return null;
  const place = (i: number): string =>
    i === 0
      ? "md:col-span-8 md:row-span-2"
      : i === 1
        ? "md:col-span-4 md:row-span-2"
        : "md:col-span-4";
  const aspect = (i: number): string =>
    i === 0
      ? "aspect-[2/1]"
      : i === 1
        ? "aspect-square md:aspect-auto"
        : "aspect-video";
  const anyPicture = cards.some((c) => c.picture !== null);
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-12">
        {cards.map((c, i) => (
          <li key={c.slug} className={place(i)}>
            <NextLink
              href={`/ships/${c.slug}`}
              className={`group relative block h-full overflow-hidden rounded-card bg-inset no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${i === 0 ? "shadow-lift" : "shadow-soft"}`}
            >
              {c.picture === null ? (
                <div className={`${aspect(i)} h-full w-full`} />
              ) : (
                <img
                  src={c.picture.src}
                  srcSet={c.picture.srcSet}
                  sizes={
                    i === 0
                      ? "(min-width: 768px) 66vw, 100vw"
                      : "(min-width: 768px) 33vw, 100vw"
                  }
                  width={c.picture.width}
                  height={c.picture.height}
                  alt=""
                  // The dispatches above carry the page's priority picture (ADR-038); the first
                  // card still loads with the page, the rest as they come into view.
                  loading={i === 0 ? undefined : "lazy"}
                  decoding="async"
                  className={`block h-full w-full object-cover ${aspect(i)}`}
                />
              )}
              <div
                className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 md:p-6 ${c.picture === null ? "" : "art-scrim pt-16"}`}
              >
                <p
                  className={`m-0 text-heading ${c.picture === null ? "text-primary" : "text-on-art"}`}
                >
                  {c.maker} {c.name}
                </p>
                {c.note === "" ? null : (
                  <p
                    className={`m-0 text-caption ${c.picture === null ? "text-secondary" : "text-on-art/80"}`}
                  >
                    {c.note}
                  </p>
                )}
              </div>
            </NextLink>
          </li>
        ))}
      </ul>
      {anyPicture ? (
        <p className="m-0 text-caption text-muted">{RSI_IMAGE_CREDIT.text}</p>
      ) : null}
    </div>
  );
}

/**
 * The one link under the featured ships (ADR-038): the whole register, with the pack's count of
 * ships and ground vehicles, concept ships included.
 */
export function RegisterLink({ count }: { readonly count: number }) {
  return (
    <p className="m-0 text-ui">
      <NextLink
        href="/ships"
        className={`${link} font-medium text-primary hover:text-accent`}
      >
        See all {count} ships and vehicles in the register
      </NextLink>
    </p>
  );
}

/** A running head over a block: the label as the heading, a link at the right. */
export function RunningHead({
  id,
  title,
  aside,
}: {
  readonly id: string;
  readonly title: string;
  readonly aside?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
      <h2 id={id} className="lab m-0 text-primary">
        {title}
      </h2>
      {aside === undefined ? null : (
        <span className="text-caption text-secondary">{aside}</span>
      )}
    </div>
  );
}
