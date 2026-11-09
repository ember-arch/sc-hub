import type { ReactNode } from "react";
import {
  type DailyPoint,
  MONTHS,
  type Measure,
  type TrendPoint,
  type YearPath,
  type YearRow,
  formatChange,
  formatCompact,
  formatDay,
  formatValue,
} from "../../lib/funding";

/**
 * The funding page's charts (ADR-018), server-rendered. One accent (system.md): the current year
 * and single series in the accent, earlier years in the ink tokens with a dash as the second cue,
 * magnitude as the accent's tint. Lines live in a viewBox-scaled SVG with non-scaling strokes;
 * every label is HTML in text tokens, so nothing scales down on a phone. Every mark carries a
 * title, so hovering (or a screen reader) reads the exact value; a table view sits under each.
 */

const W = 1000;
const H = 300;

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Horizontal bars, one per year, the amount added and its change on the previous year. */
export function YearBars({
  rows,
  measure,
}: {
  readonly rows: readonly YearRow[];
  readonly measure: Measure;
}) {
  const max = Math.max(...rows.map((r) => r.total ?? 0), 1);
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((r) => {
        const title =
          r.total === null
            ? `${r.year}: no complete data`
            : `${r.year}${r.partial ? " so far" : ""}: ${formatValue(r.total, measure)}${
                r.change === null
                  ? ""
                  : `, ${formatChange(r.change)} on ${r.year - 1}`
              }`;
        return (
          <li
            key={r.year}
            title={title}
            className="grid grid-cols-[3.5rem_1fr_11rem] items-center gap-3 text-ui"
          >
            <span className="font-mono text-secondary">{r.year}</span>
            <span
              className="relative h-6 rounded-control bg-inset"
              aria-hidden="true"
            >
              {r.total === null ? null : (
                <span
                  className={`absolute inset-y-0 left-0 rounded-control ${r.partial ? "bg-accent/55" : "bg-accent"}`}
                  style={{ width: `${Math.max((r.total / max) * 100, 0.5)}%` }}
                />
              )}
            </span>
            <span className="flex items-baseline justify-end gap-2 whitespace-nowrap">
              {r.total === null ? (
                <span className="text-caption text-muted">
                  no complete data
                </span>
              ) : (
                <>
                  <span className="font-mono text-primary">
                    {formatCompact(r.total, measure)}
                  </span>
                  {r.partial ? (
                    <span className="text-caption text-secondary">so far</span>
                  ) : r.change === null ? null : (
                    <span className="font-mono text-caption text-secondary">
                      {formatChange(r.change)}
                    </span>
                  )}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The accent's tint for a month, by its share of the largest month on the grid. */
function tint(value: number, max: number): string {
  const share = max <= 0 ? 0 : value / max;
  if (share <= 0) return "";
  if (share < 0.15) return "bg-accent/10";
  if (share < 0.3) return "bg-accent/20";
  if (share < 0.5) return "bg-accent/35";
  if (share < 0.75) return "bg-accent/50";
  return "bg-accent/70";
}

/**
 * Every month of every year, shaded by size: a table on wide screens, one block per year on
 * phones (system.md: no table scrolls sideways). Unknown months say so.
 */
export function MonthGrid({
  rows,
  measure,
}: {
  readonly rows: readonly YearRow[];
  readonly measure: Measure;
}) {
  const max = Math.max(...rows.flatMap((r) => r.months.map((m) => m ?? 0)), 1);
  const cellTitle = (r: YearRow, i: number): string => {
    const v = r.months[i];
    return v === null || v === undefined
      ? `${MONTHS[i]} ${r.year}: no data`
      : `${MONTHS[i]} ${r.year}: ${formatValue(v, measure)}`;
  };
  return (
    <>
      <table className="hidden w-full border-separate border-spacing-0.5 text-caption md:table">
        <caption className="sr-only">Amount added each month, by year</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-12 text-left font-regular text-secondary"
            >
              Year
            </th>
            {MONTHS.map((m) => (
              <th
                key={m}
                scope="col"
                className="text-right font-regular text-secondary"
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <th
                scope="row"
                className="text-left font-mono font-regular text-secondary"
              >
                {r.year}
              </th>
              {r.months.map((v, i) => (
                <td
                  key={i}
                  title={cellTitle(r, i)}
                  className={`rounded-control px-1 py-2 text-right font-mono tabular-nums ${
                    v === null
                      ? "bg-inset text-muted"
                      : `${tint(v, max)} text-primary`
                  }`}
                >
                  {v === null ? "·" : formatCompact(v, measure)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
        {rows.map((r) => (
          <li key={r.year} className="flex flex-col gap-1">
            <p className="m-0 flex items-baseline justify-between text-ui">
              <span className="font-mono text-primary">{r.year}</span>
              {r.total === null ? (
                <span className="text-caption text-muted">
                  no complete data
                </span>
              ) : (
                <span className="font-mono text-secondary">
                  {formatCompact(r.total, measure)}
                </span>
              )}
            </p>
            <ul className="m-0 grid list-none grid-cols-4 gap-1 p-0">
              {r.months.map((v, i) => (
                <li
                  key={i}
                  title={cellTitle(r, i)}
                  className={`flex flex-col rounded-control px-2 py-1 text-caption ${
                    v === null ? "bg-inset" : tint(v, max)
                  }`}
                >
                  <span className="text-secondary">{MONTHS[i]}</span>
                  <span
                    className={`font-mono ${v === null ? "text-muted" : "text-primary"}`}
                  >
                    {v === null ? "·" : formatCompact(v, measure)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}

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

/** The chart frame: the SVG plot with HTML labels laid over it by percentage. */
function Frame({
  children,
  labels,
  yTicks,
  xTicks,
  ariaLabel,
}: {
  readonly children: ReactNode;
  readonly labels: ReactNode;
  readonly yTicks: readonly { at: number; text: string }[];
  readonly xTicks: readonly { at: number; text: string }[];
  readonly ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative ml-16 h-56 md:h-72">
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
          role="img"
          aria-label={ariaLabel}
        >
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
          {children}
        </svg>
        {labels}
      </div>
      <div
        aria-hidden="true"
        className="relative ml-16 h-5 text-caption text-muted"
      >
        {xTicks.map((t) => (
          <span
            key={`${t.at}-${t.text}`}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${t.at}%` }}
          >
            {t.text}
          </span>
        ))}
      </div>
    </div>
  );
}

const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/** Three years' running totals against the day of the year. */
export function YearVsYear({
  paths,
  measure,
}: {
  readonly paths: readonly YearPath[];
  readonly measure: Measure;
}) {
  const yMax = Math.max(
    ...paths.flatMap((p) => p.points.map((q) => q.value)),
    1,
  );
  const s = scale(1, 366, 0, yMax);
  const styles = ["stroke-accent", "stroke-primary", "stroke-muted"] as const;
  const dashes = [undefined, undefined, "6 5"] as const;
  const ordered = [...paths].sort((a, b) => b.year - a.year);
  // One hover column per day of year, reading every year's value that day.
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
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-caption text-secondary">
        {ordered.map((p, i) => (
          <li key={p.year} className="flex items-center gap-2">
            <svg width={24} height={8} aria-hidden="true">
              <line
                x1={0}
                x2={24}
                y1={4}
                y2={4}
                className={styles[i] ?? "stroke-muted"}
                strokeWidth={2}
                strokeDasharray={dashes[i]}
              />
            </svg>
            <span className="font-mono text-primary">{p.year}</span>
            {i === 0 ? <span>this year</span> : null}
          </li>
        ))}
      </ul>
      <Frame
        ariaLabel={`Running total added within each year, ${ordered.map((p) => p.year).join(", ")}`}
        yTicks={ticks}
        xTicks={MONTH_STARTS.map((d, i) => ({
          at: ((d - 1) / 365) * 100,
          text: MONTHS[i] ?? "",
        }))}
        labels={ordered.map((p, i) => {
          const last = p.points.at(-1);
          if (last === undefined) return null;
          return (
            // Near the right edge the label sits above the line's end, anchored right, so it never
            // runs past the frame on a phone.
            <span
              key={p.year}
              aria-hidden="true"
              className={`absolute font-mono text-caption ${i === 0 ? "text-primary" : "text-secondary"} ${
                last.doy > 240
                  ? "-translate-y-full pb-1"
                  : "-translate-y-1/2 pl-2"
              }`}
              style={{
                ...(last.doy > 240
                  ? { right: `${100 - (s.x(last.doy) / W) * 100}%` }
                  : { left: `${(s.x(last.doy) / W) * 100}%` }),
                top: `${(s.y(last.value) / H) * 100}%`,
              }}
            >
              {formatCompact(last.value, measure)}
            </span>
          );
        })}
      >
        {ordered.map((p, i) => (
          <path
            key={p.year}
            d={pathOf(
              p.points.map((q) => ({ x: s.x(q.doy), y: s.y(q.value) })),
            )}
            fill="none"
            className={styles[i] ?? "stroke-muted"}
            strokeWidth={i === 0 ? 2 : 1.5}
            strokeDasharray={dashes[i]}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
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

/** The trailing year against the year before it, day by day. */
export function TrendLine({
  points,
}: {
  readonly points: readonly TrendPoint[];
}) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.change);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo) * 0.1 || 0.05;
  const s = scale(0, points.length - 1, lo - pad, hi + pad);
  const last = points.at(-1);
  const years = [...new Set(points.map((p) => p.day.slice(0, 4)))];
  const ticks = [...new Set([lo, 0, hi / 2, hi])].map((v) => ({
    at: (s.y(v) / H) * 100,
    text: formatChange(v),
  }));
  return (
    <Frame
      ariaLabel="Change of the trailing 365-day total against the 365 days before, day by day"
      yTicks={ticks}
      xTicks={years.map((y) => ({
        at:
          (points.findIndex((p) => p.day.startsWith(y)) / (points.length - 1)) *
          100,
        text: y,
      }))}
      labels={
        last === undefined ? null : (
          <span
            aria-hidden="true"
            className="absolute right-0 -translate-y-full pb-1 font-mono text-caption text-primary"
            style={{ top: `${(s.y(last.change) / H) * 100}%` }}
          >
            {formatChange(last.change)}
          </span>
        )
      }
    >
      <line
        x1={0}
        x2={W}
        y1={s.y(0)}
        y2={s.y(0)}
        className="stroke-hairline-strong"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={pathOf(points.map((p, i) => ({ x: s.x(i), y: s.y(p.change) })))}
        fill="none"
        className="stroke-accent"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) => (
        <rect
          key={p.day}
          x={s.x(i) - W / points.length / 2}
          y={0}
          width={W / points.length}
          height={H}
          fill="transparent"
        >
          <title>{`${formatDay(p.day)}: ${formatChange(p.change)} on the year before`}</title>
        </rect>
      ))}
    </Frame>
  );
}

/** Every day since 2012: the amount added per day, as a thin line. */
export function DailyHistory({
  points,
  measure,
}: {
  readonly points: readonly DailyPoint[];
  readonly measure: Measure;
}) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.perDay);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, 1);
  const s = scale(0, points.length - 1, lo, hi);
  const years = [...new Set(points.map((p) => p.day.slice(0, 4)))].filter(
    (y) => Number(y) % 2 === 1,
  );
  const ticks = [0, 0.5, 1].map((f) => ({
    at: (s.y(f * hi) / H) * 100,
    text: formatCompact(f * hi, measure),
  }));
  // A column per week keeps the hover layer to a few hundred targets.
  const week = 7;
  const columns: { from: number; to: number }[] = [];
  for (let i = 0; i < points.length; i += week)
    columns.push({ from: i, to: Math.min(i + week, points.length) });
  return (
    <Frame
      ariaLabel="Amount added per day since the campaign began"
      yTicks={ticks}
      xTicks={years.map((y) => ({
        at:
          (points.findIndex((p) => p.day.startsWith(y)) / (points.length - 1)) *
          100,
        text: y,
      }))}
      labels={null}
    >
      <path
        d={pathOf(points.map((p, i) => ({ x: s.x(i), y: s.y(p.perDay) })))}
        fill="none"
        className="stroke-accent"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {columns.map((c) => {
        const slice = points.slice(c.from, c.to);
        const first = slice[0];
        const peak = slice.reduce(
          (m, p) => (p.perDay > m.perDay ? p : m),
          slice[0] ?? { day: "", perDay: 0 },
        );
        if (first === undefined) return null;
        return (
          <rect
            key={first.day}
            x={s.x(c.from)}
            y={0}
            width={s.x(c.to - 1) - s.x(c.from) || 1}
            height={H}
            fill="transparent"
          >
            <title>{`Week of ${formatDay(first.day)}: ${formatValue(Math.round(sum(slice.map((p) => p.perDay))), measure)} added; best day ${formatDay(peak.day)}, ${formatValue(Math.round(peak.perDay), measure)}`}</title>
          </rect>
        );
      })}
    </Frame>
  );
}
