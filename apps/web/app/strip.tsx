import NextLink from "next/link";
import type { ReactNode } from "react";

/**
 * The almanac's figure strip (ADR-020): headline figures over a 2 px ink rule, each a label, a
 * mono value and a note; a figure with an `href` links to the page it summarises. The front page
 * and the parts index open on one, and the front page's funding card carries another (ADR-040).
 */

export interface Figure {
  readonly label: string;
  readonly value: ReactNode;
  /** A shorter form of the value for phones, where the full one would not fit. */
  readonly short?: ReactNode;
  readonly note?: ReactNode;
  readonly href?: string | undefined;
}

/** Literal class names per count so Tailwind's scanner sees each one. */
const COLUMNS: Readonly<Record<number, string>> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

/** The same, below md. */
const PHONE_COLUMNS: Readonly<Record<number, string>> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

const link =
  "no-underline transition-colors duration-hover hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

export function FigureStrip({
  figures,
  columns,
  phoneColumns = 2,
}: {
  readonly figures: readonly Figure[];
  /** Columns from md up; the count of figures when omitted (at most six). */
  readonly columns?: number | undefined;
  /** Columns below md: two as a rule; three for a strip of three short figures (ADR-038). */
  readonly phoneColumns?: 1 | 2 | 3 | undefined;
}) {
  if (figures.length === 0) return null;
  const cols =
    COLUMNS[columns ?? Math.min(figures.length, 6)] ?? "md:grid-cols-5";
  const phone = PHONE_COLUMNS[phoneColumns] ?? "grid-cols-2";
  return (
    <dl className={`m-0 grid ${phone} gap-x-6 gap-y-4 py-3 ${cols}`}>
      {figures.map((f, i) => {
        const value =
          f.short === undefined ? (
            f.value
          ) : (
            <>
              <span className="md:hidden">{f.short}</span>
              <span className="hidden md:inline">{f.value}</span>
            </>
          );
        return (
          <div
            key={f.label}
            className={`flex flex-col gap-1 ${i === 0 ? "md:pr-4" : "md:px-4"}`}
          >
            <dt className="lab text-secondary">{f.label}</dt>
            <dd className="m-0 flex flex-col gap-1">
              {f.href === undefined ? (
                <span className="font-mono text-heading tracking-normal text-primary">
                  {value}
                </span>
              ) : (
                <NextLink
                  href={f.href}
                  className={`${link} font-mono text-heading tracking-normal text-primary`}
                >
                  {value}
                </NextLink>
              )}
              {f.note === undefined ? null : (
                <span className="text-caption text-secondary">{f.note}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
