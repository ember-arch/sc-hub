import NextLink from "next/link";
import type { ReactNode } from "react";
import { Plate, type PlatePicture } from "ui";
import { RSI_IMAGE_CREDIT } from "ui/legal";
import { CONTENTS, romanNumeral } from "../lib/front";

/**
 * The front page's parts (ADR-020): the contents list, the counters strip and the plates. Pure
 * presentation; page.tsx reads the data and hands it in.
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

export interface Counter {
  readonly label: string;
  readonly value: string;
  readonly note: ReactNode;
  readonly href: string;
}

/** Literal class names per count so Tailwind's scanner sees each one. */
const COLUMNS: Readonly<Record<number, string>> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

/** The site's headline figures over a 2 px ink rule, each a link to the page it summarises. */
export function Counters({
  counters,
}: {
  readonly counters: readonly Counter[];
}) {
  if (counters.length === 0) return null;
  return (
    <dl
      className={`m-0 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-t-2 border-b-hairline-strong border-t-primary py-3 md:gap-x-0 md:divide-x md:divide-hairline ${COLUMNS[counters.length] ?? "md:grid-cols-5"}`}
    >
      {counters.map((c, i) => (
        <div
          key={c.label}
          className={`flex flex-col gap-1 ${i === 0 ? "md:pr-4" : "md:px-4"}`}
        >
          <dt className="lab text-secondary">{c.label}</dt>
          <dd className="m-0 flex flex-col gap-1">
            <NextLink
              href={c.href}
              className={`${link} font-mono text-heading tracking-normal text-primary hover:text-accent`}
            >
              {c.value}
            </NextLink>
            <span className="text-caption text-secondary">{c.note}</span>
          </dd>
        </div>
      ))}
    </dl>
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

/** The hero plate with two beside it; one wide frame alone when only one ship has a picture. */
export function HeroPlates({
  plates,
}: {
  readonly plates: readonly PlateEntry[];
}) {
  const [first, ...side] = plates;
  if (first === undefined) return null;
  const caption = (p: PlateEntry): ReactNode => (
    <>
      <NextLink
        href={`/ships/${p.slug}`}
        className={`${link} text-primary hover:text-accent`}
      >
        {p.maker} {p.name}
      </NextLink>
      {p.note === "" ? null : `, ${p.note}`}
    </>
  );
  return (
    <div
      className={`grid gap-3 ${side.length === 0 ? "" : "md:grid-cols-[2fr_1fr]"}`}
    >
      <Plate
        picture={first.picture}
        numeral={`Plate ${romanNumeral(1)}`}
        caption={caption(first)}
        credit={RSI_IMAGE_CREDIT.text}
        href={`/ships/${first.slug}`}
        aspect="wide"
        sizes="(min-width: 768px) 66vw, 100vw"
        priority
      />
      {side.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {side.map((p, i) => (
            <Plate
              key={p.slug}
              picture={p.picture}
              numeral={`Plate ${romanNumeral(i + 2)}`}
              caption={caption(p)}
              credit={RSI_IMAGE_CREDIT.text}
              href={`/ships/${p.slug}`}
              aspect="panorama"
              sizes="(min-width: 768px) 33vw, 50vw"
            />
          ))}
        </div>
      )}
    </div>
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
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline-strong pb-2">
      <h2 id={id} className="lab m-0 text-primary">
        {title}
      </h2>
      {aside === undefined ? null : (
        <span className="text-caption text-secondary">{aside}</span>
      )}
    </div>
  );
}
