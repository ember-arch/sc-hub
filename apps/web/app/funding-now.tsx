import {
  MONTHS,
  type Measure,
  type MonthPair,
  type Reading,
  formatChange,
  formatCompact,
  formatShare,
  formatValue,
  monthPairs,
  yearAgainstLastYear,
  yearPaths,
  yearRows,
} from "../lib/funding";
import { Frame, H, W, YearVsYear, pct } from "./funding/charts";
import { FigureStrip } from "./strip";
import { ViewToggle } from "./view-toggle";

/**
 * The front page's funding card (ADR-038): this year so far against last year, in three figures
 * and one drawing with two views. "Year to date" is the ledger's own year-against-year chart for
 * this year and last; "By month" pairs each month so far with the same month last year. Every
 * number is the ledger's (ADR-018): differences between RSI's snapshots, never estimated.
 */
export function FundingNow({
  list,
  measure,
}: {
  readonly list: readonly Reading[];
  readonly measure: Measure;
}) {
  const against = yearAgainstLastYear(list);
  const latest = list.at(-1);
  if (against === null || latest === undefined) return null;
  const { year, yearToDate, shareOfLastYear, change, lastYearTotal } = against;
  const rows = yearRows(list);
  const pairs = monthPairs(rows, latest.day);
  const paths = yearPaths(list, [year, year - 1]);
  const figures = [
    {
      label: `Pledged in ${year} so far`,
      value: yearToDate === null ? "unknown" : formatValue(yearToDate, measure),
      short:
        yearToDate === null ? "unknown" : formatCompact(yearToDate, measure),
      note: `to ${formatDayShort(latest.day)}`,
    },
    {
      label: `Of ${year - 1}'s total`,
      value:
        shareOfLastYear === null ? "unknown" : formatShare(shareOfLastYear),
      note:
        lastYearTotal === null
          ? "last year's total is unknown"
          : `${formatCompact(lastYearTotal, measure)} in all of ${year - 1}`,
    },
    {
      label: "Year on year",
      value: change === null ? "unknown" : formatChange(change),
      note: `on the same days of ${year - 1}`,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <FigureStrip columns={3} figures={figures} />
      <ViewToggle
        label="Funding view"
        views={[
          {
            id: "ytd",
            label: "Year to date",
            content:
              paths.length >= 2 ? (
                <YearVsYear paths={paths} measure={measure} latestYear={year} />
              ) : (
                <p className="m-0 text-ui text-secondary">
                  Not enough readings this year to draw against last year yet.
                </p>
              ),
          },
          {
            id: "months",
            label: "By month",
            content:
              pairs.length > 0 ? (
                <MonthPairs pairs={pairs} year={year} measure={measure} />
              ) : (
                <p className="m-0 text-ui text-secondary">
                  No month of this year has a reading at both ends yet.
                </p>
              ),
          },
        ]}
      />
    </div>
  );
}

const shortDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "9 Nov": the latest reading's day, short enough for a figure's note. */
function formatDayShort(day: string): string {
  return shortDay.format(new Date(`${day}T00:00:00Z`));
}

/**
 * Each month so far as a pair of bars on the ledger's graph paper: last year's month in the ink's
 * tint, this year's in the accent (the current month at half strength, as the ledger draws a
 * period that is not over), the change on last year's month under each pair from `md` and in
 * every bar's title; the current month, not over, carries no change. The top band of the plot is
 * kept clear for the labels.
 */
export function MonthPairs({
  pairs,
  year,
  measure,
}: {
  readonly pairs: readonly MonthPair[];
  readonly year: number;
  readonly measure: Measure;
}) {
  const values = pairs.flatMap((p) => [p.thisYear ?? 0, p.lastYear ?? 0]);
  const top = Math.max(...values, 1);
  // Headroom of a sixth for the change labels, so no bar reaches them.
  const yMax = top * 1.2;
  const slot = W / pairs.length;
  const bar = slot * 0.32;
  const gap = slot * 0.06;
  const heightOf = (v: number): number => (v / yMax) * H;
  const ticks = [0, 0.5, 1].map((f) => ({
    at: pct(H - heightOf(f * top), H),
    text: formatCompact(f * top, measure),
  }));
  const titleOf = (p: MonthPair, which: "thisYear" | "lastYear"): string => {
    const y = which === "thisYear" ? year : year - 1;
    const v = p[which];
    const soFar = which === "thisYear" && p.current ? " so far" : "";
    return v === null
      ? `${MONTHS[p.month]} ${y}: no data`
      : `${MONTHS[p.month]} ${y}${soFar}: ${formatValue(v, measure)}${
          which === "thisYear" && p.change !== null
            ? `, ${formatChange(p.change)} on ${MONTHS[p.month]} ${y - 1}`
            : ""
        }`;
  };
  const summary = pairs
    .map((p) =>
      p.thisYear === null || p.lastYear === null
        ? `${MONTHS[p.month]}: no comparison`
        : `${MONTHS[p.month]}: ${formatCompact(p.thisYear, measure)} against ${formatCompact(p.lastYear, measure)} in ${year - 1}${p.change === null ? "" : ` (${formatChange(p.change)})`}${p.current ? ", so far" : ""}`,
    )
    .join("; ");
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-caption text-secondary">
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-6 rounded-control bg-accent"
          />
          <span className="font-mono text-primary">{year}</span>
          <span>this year</span>
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-6 rounded-control bg-primary/35"
          />
          <span className="font-mono text-primary">{year - 1}</span>
        </li>
      </ul>
      <Frame
        summary={`Each month of ${year} so far beside the same month of ${year - 1}. ${summary}.`}
        yTicks={ticks}
        xTicks={pairs.map((p, i) => ({
          at: pct((i + 0.5) * slot, W),
          text: MONTHS[p.month] ?? "",
        }))}
        labels={pairs.map((p, i) =>
          p.change === null ? null : (
            <span
              key={p.month}
              aria-hidden="true"
              className="absolute top-0 hidden -translate-x-1/2 whitespace-nowrap font-mono text-caption text-secondary md:inline"
              style={{ left: `${pct((i + 0.5) * slot, W)}%` }}
            >
              {formatChange(p.change)}
            </span>
          ),
        )}
      >
        {pairs.map((p, i) => {
          const x0 = i * slot + (slot - 2 * bar - gap) / 2;
          return (
            <g key={p.month}>
              {p.lastYear === null ? null : (
                <rect
                  x={x0}
                  y={H - heightOf(p.lastYear)}
                  width={bar}
                  height={heightOf(p.lastYear)}
                  className="fill-primary/35"
                >
                  <title>{titleOf(p, "lastYear")}</title>
                </rect>
              )}
              {p.thisYear === null ? null : (
                <rect
                  x={x0 + bar + gap}
                  y={H - heightOf(p.thisYear)}
                  width={bar}
                  height={heightOf(p.thisYear)}
                  className={p.current ? "fill-accent/50" : "fill-accent"}
                >
                  <title>{titleOf(p, "thisYear")}</title>
                </rect>
              )}
            </g>
          );
        })}
      </Frame>
    </div>
  );
}
