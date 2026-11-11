import type { ReactNode } from "react";
import {
  MONTHS,
  type Measure,
  type YearPath,
  formatCompact,
  formatValue,
} from "../lib/funding";

/**
 * The funding drawings the front page keeps from the ledger (ADR-018, ADR-020, ADR-040): the
 * chart frame on graph paper and the year-against-year running totals, server-rendered. Ink for
 * the record and one accent for the present: last year in ink with a dash as the second cue, this
 * year in the accent. Lines live in a viewBox-scaled SVG with non-scaling strokes; every label is
 * HTML in text tokens, so nothing scales down on a phone; every mark carries a title for pointer
 * readers and each chart a sentence for screen readers. Sizes come from the spacing tokens, the
 * plot's shape from an aspect ratio (ADR-018).
 */

export const W = 1000;
export const H = 300;

interface Scale {
  readonly x: (v: number) => number;
  readonly y: (v: number) => number;
}

function scale(xMin: number, xMax: number, yMin: number, yMax: number): Scale {
  const dx = xMax - xMin || 1;
  const dy = yMax - yMin || 1;
  return {
    x: (v) => ((v - xMin) / dx) * W,
    y: (v) => H - ((v - yMin) / dy) * H,
  };
}

const pathOf = (pts: readonly { x: number; y: number }[]): string =>
  pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

export const pct = (v: number, of: number): number => (v / of) * 100;

/**
 * The chart frame: the SVG plot with HTML labels laid over it by percentage. The plot's shape is
 * an aspect ratio (2:1 on phones, 3:1 from md), so it has a height without a size outside the
 * tokens (ADR-018). `summary` is read instead of the drawing by assistive tech.
 */
export function Frame({
  children,
  labels,
  yTicks,
  xTicks,
  summary,
}: {
  readonly children: ReactNode;
  readonly labels: ReactNode;
  readonly yTicks: readonly { at: number; text: string }[];
  readonly xTicks: readonly { at: number; text: string; phone?: boolean }[];
  readonly summary: string;
}) {
  return (
    <figure className="m-0 flex flex-col gap-1 rounded-card bg-surface shadow-soft p-4">
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="relative ml-16 aspect-[2/1] md:aspect-[3/1]">
        {yTicks.map((t) => (
          <span
            key={`${t.at}-${t.text}`}
            aria-hidden="true"
            className="absolute right-full -translate-y-1/2 pr-2 font-mono text-caption text-muted"
            style={{ top: `${t.at}%` }}
          >
            {t.text}
          </span>
        ))}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-full w-full overflow-visible"
          aria-hidden="true"
        >
          {/* Graph paper: a hairline at every tick, both ways. */}
          {yTicks.map((t) => (
            <line
              key={`${t.at}-${t.text}`}
              x1={0}
              x2={W}
              y1={(t.at / 100) * H}
              y2={(t.at / 100) * H}
              className="stroke-hairline"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`x-${t.at}-${t.text}`}
              x1={(t.at / 100) * W}
              x2={(t.at / 100) * W}
              y1={0}
              y2={H}
              className="stroke-hairline"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {children}
        </svg>
        {labels}
      </div>
      <div
        aria-hidden="true"
        className="relative ml-16 h-6 text-caption text-muted"
      >
        {xTicks.map((t) => (
          <span
            key={`${t.at}-${t.text}`}
            className={`absolute -translate-x-1/2 whitespace-nowrap ${t.phone === false ? "hidden md:inline" : ""}`}
            style={{ left: `${t.at}%` }}
          >
            {t.text}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Day of year on which each month starts, in a leap year (the x axis holds 366 days). */
const MONTH_STARTS = [1, 32, 61, 92, 122, 153, 183, 214, 245, 275, 306, 336];

/** Up to three years' running totals against the day of the year. */
export function YearVsYear({
  paths,
  measure,
  latestYear,
}: {
  readonly paths: readonly YearPath[];
  readonly measure: Measure;
  /** The year the latest reading falls in; it may have too few readings for a path yet. */
  readonly latestYear: number;
}) {
  const yMax = Math.max(
    ...paths.flatMap((p) => p.points.map((q) => q.value)),
    1,
  );
  const s = scale(1, 366, 0, yMax);
  const ordered = [...paths].sort((a, b) => b.year - a.year);
  // The current year in the accent and solid; earlier years in ink, each with its own dash.
  const styleOf = (p: YearPath, i: number) =>
    p.year === latestYear
      ? { stroke: "stroke-accent", dash: undefined, width: 2 }
      : i === 0 || (i === 1 && ordered[0]?.year === latestYear)
        ? { stroke: "stroke-primary", dash: "6 5", width: 1.5 }
        : { stroke: "stroke-muted", dash: "2 4", width: 1.5 };
  const byDoy = new Map<number, string[]>();
  for (const p of ordered) {
    for (const q of p.points) {
      const list = byDoy.get(q.doy) ?? [];
      list.push(`${p.year}: ${formatValue(q.value, measure)}`);
      byDoy.set(q.doy, list);
    }
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    at: 100 - f * 100,
    text: formatCompact(f * yMax, measure),
  }));
  const ends = ordered.map((p) => {
    const last = p.points.at(-1);
    return last === undefined
      ? `${p.year}: no readings`
      : `${p.year}: ${formatValue(last.value, measure)} by day ${last.doy}`;
  });
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-caption text-secondary">
        {ordered.map((p, i) => {
          const st = styleOf(p, i);
          return (
            <li key={p.year} className="flex items-center gap-2">
              <svg width={24} height={8} aria-hidden="true">
                <line
                  x1={0}
                  x2={24}
                  y1={4}
                  y2={4}
                  className={st.stroke}
                  strokeWidth={2}
                  strokeDasharray={st.dash}
                />
              </svg>
              <span className="font-mono text-primary">{p.year}</span>
              {p.year === latestYear ? <span>this year</span> : null}
            </li>
          );
        })}
      </ul>
      <Frame
        summary={`Running total added within each year by day of the year. ${ends.join("; ")}.`}
        yTicks={ticks}
        xTicks={MONTH_STARTS.map((d, i) => ({
          at: pct(d - 1, 365),
          text: MONTHS[i] ?? "",
          phone: i % 3 === 0,
        }))}
        labels={ordered.map((p, i) => {
          const last = p.points.at(-1);
          if (last === undefined) return null;
          const nearEnd = last.doy > 240;
          return (
            // Near the right edge the label sits above the line's end, anchored right, so it
            // never runs past the frame on a phone.
            <span
              key={p.year}
              aria-hidden="true"
              className={`absolute font-mono text-caption ${p.year === latestYear ? "text-primary" : "text-secondary"} ${
                nearEnd ? "-translate-y-full pb-1" : "-translate-y-1/2 pl-2"
              }`}
              style={{
                ...(nearEnd
                  ? { right: `${100 - pct(s.x(last.doy), W)}%` }
                  : { left: `${pct(s.x(last.doy), W)}%` }),
                top: `${pct(s.y(last.value), H)}%`,
              }}
            >
              {formatCompact(last.value, measure)}
              {i === 0 ? "" : ` ${p.year}`}
            </span>
          );
        })}
      >
        {ordered.map((p, i) => {
          const st = styleOf(p, i);
          return (
            <path
              key={p.year}
              d={pathOf(
                p.points.map((q) => ({ x: s.x(q.doy), y: s.y(q.value) })),
              )}
              fill="none"
              className={st.stroke}
              strokeWidth={st.width}
              strokeDasharray={st.dash}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {[...byDoy].map(([doy, lines]) => (
          <rect
            key={doy}
            x={s.x(doy) - W / 366 / 2}
            y={0}
            width={W / 366}
            height={H}
            fill="transparent"
          >
            <title>{`Day ${doy}\n${lines.join("\n")}`}</title>
          </rect>
        ))}
      </Frame>
    </div>
  );
}
