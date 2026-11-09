import type { ReactNode } from "react";
import {
  type DailyPoint,
  MONTHS,
  type Measure,
  type TrendPoint,
  type YearPath,
  type YearRow,
  dayNumber,
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
 * title for pointer readers; each chart also carries a sentence for screen readers, and a table
 * of every month sits under the grid. Sizes come from the spacing tokens, the plot's shape from
 * an aspect ratio (ADR-018).
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
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-ui"
          >
            <span className="w-12 font-mono text-secondary">{r.year}</span>
            <span
              className="relative h-6 rounded-control bg-inset"
              aria-hidden="true"
            >
              {r.total === null ? null : (
                <span
                  className={`absolute inset-y-0 left-0 rounded-control ${r.partial ? "bg-accent/50" : "bg-accent"}`}
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

/** The accent's tint for a month, by its share of the largest month on the grid (ADR-018). */
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
 * phones (system.md: no table scrolls sideways). Unknown months say so; a year with no known
 * month is one line on a phone.
 */
export function MonthGrid({
  rows,
  measure,
}: {
  readonly rows: readonly YearRow[];
  readonly measure: Measure;
}) {
  const max = Math.max(...rows.flatMap((r) => r.months.map((m) => m ?? 0)), 1);
  const last = rows.at(-1);
  const currentMonth =
    last?.partial === true
      ? last.months.reduce((at, m, i) => (m === null ? at : i), -1)
      : -1;
  const isCurrent = (r: YearRow, i: number): boolean =>
    r.partial && i === currentMonth;
  const cellTitle = (r: YearRow, i: number): string => {
    const v = r.months[i];
    return v === null || v === undefined
      ? `${MONTHS[i]} ${r.year}: no data`
      : `${MONTHS[i]} ${r.year}${isCurrent(r, i) ? " so far" : ""}: ${formatValue(v, measure)}`;
  };
  const cellText = (r: YearRow, i: number): string => {
    const v = r.months[i];
    if (v === null || v === undefined) return "·";
    return isCurrent(r, i)
      ? `${formatCompact(v, measure)}…`
      : formatCompact(v, measure);
  };
  return (
    <>
      <table className="hidden w-full border-separate border-spacing-1 text-caption md:table">
        <caption className="sr-only">
          Amount added each month, by year. An ellipsis marks the current month,
          which is not over.
        </caption>
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
                  className={`rounded-control px-1 py-2 text-right font-mono ${
                    v === null
                      ? "bg-inset text-muted"
                      : `${tint(v, max)} text-primary`
                  }`}
                >
                  {cellText(r, i)}
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
                  {r.months.every((m) => m === null)
                    ? "no data for any month"
                    : "no complete data"}
                </span>
              ) : (
                <span className="font-mono text-secondary">
                  {formatCompact(r.total, measure)}
                  {r.partial ? " so far" : ""}
                </span>
              )}
            </p>
            {r.months.every((m) => m === null) ? null : (
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
                      {cellText(r, i)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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

const pct = (v: number, of: number): number => (v / of) * 100;

/**
 * The chart frame: the SVG plot with HTML labels laid over it by percentage. The plot's shape is
 * an aspect ratio (2:1 on phones, 3:1 from md), so it has a height without a size outside the
 * tokens (ADR-018). `summary` is read instead of the drawing by assistive tech.
 */
function Frame({
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
    <figure className="m-0 flex flex-col gap-1">
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

/** Year ticks for a time axis that runs from `from` to `to` (day numbers). */
function yearTicks(from: number, to: number, every = 1) {
  const out: { at: number; text: string; phone?: boolean }[] = [];
  const firstYear = new Date(from * 86_400_000).getUTCFullYear() + 1;
  const lastYear = new Date(to * 86_400_000).getUTCFullYear();
  for (let y = firstYear; y <= lastYear; y += 1) {
    const n = dayNumber(`${y}-01-01`);
    out.push({
      at: pct(n - from, to - from),
      text: String(y),
      phone: (y - firstYear) % every === 0,
    });
  }
  return out;
}

/** The trailing year against the year before it, day by day, on a time axis. */
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
  const from = dayNumber(points[0]?.day ?? "");
  const to = dayNumber(points.at(-1)?.day ?? "");
  const s = scale(from, to, lo - pad, hi + pad);
  const last = points.at(-1);
  const peak = points.reduce((m, p) => (p.change > m.change ? p : m));
  const ticks = [...new Set([lo, 0, hi / 2, hi])].map((v) => ({
    at: pct(s.y(v), H),
    text: formatChange(v),
  }));
  return (
    <Frame
      summary={`The trailing 365-day total against the 365 days before, from ${formatDay(points[0]?.day ?? "")} to ${formatDay(last?.day ?? "")}: now ${formatChange(last?.change ?? 0)}, highest ${formatChange(peak.change)} on ${formatDay(peak.day)}.`}
      yTicks={ticks}
      xTicks={yearTicks(from, to)}
      labels={
        last === undefined ? null : (
          <span
            aria-hidden="true"
            className="absolute right-0 -translate-y-full pb-1 font-mono text-caption text-primary"
            style={{ top: `${pct(s.y(last.change), H)}%` }}
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
        d={pathOf(
          points.map((p) => ({ x: s.x(dayNumber(p.day)), y: s.y(p.change) })),
        )}
        fill="none"
        className="stroke-accent"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) => {
        const x0 = s.x(dayNumber(points[i - 1]?.day ?? p.day));
        const x1 = s.x(dayNumber(points[i + 1]?.day ?? p.day));
        return (
          <rect
            key={p.day}
            x={(x0 + s.x(dayNumber(p.day))) / 2}
            y={0}
            width={Math.max((x1 - x0) / 2, 0.5)}
            height={H}
            fill="transparent"
          >
            <title>{`${formatDay(p.day)}: ${formatChange(p.change)} on the year before`}</title>
          </rect>
        );
      })}
    </Frame>
  );
}

/** Every day since 2012: the amount added per day, as a thin line on a time axis. */
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
  const from = dayNumber(points[0]?.day ?? "");
  const to = dayNumber(points.at(-1)?.day ?? "");
  const s = scale(from, to, lo, hi);
  const peak = points.reduce((m, p) => (p.perDay > m.perDay ? p : m));
  const ticks = [0, 0.5, 1].map((f) => ({
    at: pct(s.y(f * hi), H),
    text: formatCompact(f * hi, measure),
  }));
  // A hover column per week keeps the targets to a few hundred.
  const columns: { from: number; to: number }[] = [];
  for (let i = 0; i < points.length; i += 7) {
    columns.push({ from: i, to: Math.min(i + 7, points.length) });
  }
  return (
    <Frame
      summary={`Amount added per day from ${formatDay(points[0]?.day ?? "")} to ${formatDay(points.at(-1)?.day ?? "")}; the best day was ${formatDay(peak.day)}, ${formatValue(Math.round(peak.perDay), measure)}.`}
      yTicks={ticks}
      xTicks={yearTicks(from, to, 2).filter((t) => Number(t.text) % 2 === 1)}
      labels={null}
    >
      <path
        d={pathOf(
          points.map((p) => ({ x: s.x(dayNumber(p.day)), y: s.y(p.perDay) })),
        )}
        fill="none"
        className="stroke-accent"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {columns.map((c) => {
        const slice = points.slice(c.from, c.to);
        const first = slice[0];
        const end = slice.at(-1);
        if (first === undefined || end === undefined) return null;
        const best = slice.reduce((m, p) => (p.perDay > m.perDay ? p : m));
        const x = s.x(dayNumber(points[c.from - 1]?.day ?? first.day));
        return (
          <rect
            key={first.day}
            x={x}
            y={0}
            width={Math.max(s.x(dayNumber(end.day)) - x, 0.5)}
            height={H}
            fill="transparent"
          >
            <title>{`${formatDay(first.day)} to ${formatDay(end.day)}: ${formatValue(Math.round(sum(slice.map((p) => p.perDay))), measure)} added; best day ${formatDay(best.day)}, ${formatValue(Math.round(best.perDay), measure)}`}</title>
          </rect>
        );
      })}
    </Frame>
  );
}
