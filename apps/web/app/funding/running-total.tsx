import {
  type Measure,
  type Reading,
  dayNumber,
  firstCrossing,
  formatCompact,
  formatDay,
  formatValue,
  totalSegments,
} from "../../lib/funding";
import { Frame, H, W, pathOf, pct, scale, yearTicks } from "./charts";

/**
 * The running total since the first snapshot, in ink (ADR-020): solid where the API has readings,
 * dashed across a gap of `gapDays` or more (joined, never estimated, ADR-018), with the
 * milestone's first crossing marked in the accent.
 */
export function RunningTotal({
  list,
  measure,
  gapDays,
  milestone,
}: {
  readonly list: readonly Reading[];
  readonly measure: Measure;
  readonly gapDays: number;
  /** A round figure to mark where the counter first reached it; null for none. */
  readonly milestone: number | null;
}) {
  const first = list[0];
  const last = list.at(-1);
  if (first === undefined || last === undefined || list.length < 2) return null;
  const from = dayNumber(first.day);
  const to = dayNumber(last.day);
  const yMax = Math.max(...list.map((r) => r.value), 1);
  const s = scale(from, to, 0, yMax);
  const segments = totalSegments(list, gapDays);
  const bridges = segments.filter((seg) => seg.bridge);
  const crossing = milestone === null ? null : firstCrossing(list, milestone);
  const ticks = [0, 0.5, 1].map((f) => ({
    at: pct(s.y(f * yMax), H),
    text: formatCompact(f * yMax, measure),
  }));
  // A hover column per thirty readings keeps the targets to a few hundred.
  const columns: { from: number; to: number }[] = [];
  for (let i = 0; i < list.length; i += 30) {
    columns.push({ from: i, to: Math.min(i + 30, list.length) });
  }
  const bridgeNote =
    bridges.length === 0
      ? ""
      : ` The dashed ${bridges.length > 1 ? "stretches are" : "stretch is"} ${bridges
          .map(
            (b) =>
              `${formatDay(b.points[0]?.day ?? "")} to ${formatDay(b.points[1]?.day ?? "")}`,
          )
          .join(", ")}, where the API holds no readings.`;
  const crossingNote =
    crossing === null || milestone === null
      ? ""
      : ` The counter first reached ${formatCompact(milestone, measure)} on ${formatDay(crossing.day)}.`;
  return (
    <Frame
      summary={`The running total from ${formatDay(first.day)} to ${formatDay(last.day)}: ${formatValue(first.value, measure)} to ${formatValue(last.value, measure)}.${bridgeNote}${crossingNote}`}
      yTicks={ticks}
      // Even years only, each shown on phones too: seven short labels fit a 390 px plot.
      xTicks={yearTicks(from, to, 1).filter((t) => Number(t.text) % 2 === 0)}
      labels={
        crossing === null || milestone === null ? null : (
          // The label sits below and to the left of the point, so it never runs off the right edge
          // or above the frame.
          <span
            aria-hidden="true"
            className="absolute -translate-x-full whitespace-nowrap pr-3 pt-2 font-mono text-caption text-primary"
            style={{
              left: `${pct(s.x(dayNumber(crossing.day)), W)}%`,
              top: `${pct(s.y(crossing.value), H)}%`,
            }}
          >
            {formatCompact(milestone, measure)}, {formatDay(crossing.day)}
          </span>
        )
      }
    >
      {segments.map((seg) => (
        <path
          key={seg.points[0]?.day ?? ""}
          d={pathOf(
            seg.points.map((r) => ({
              x: s.x(dayNumber(r.day)),
              y: s.y(r.value),
            })),
          )}
          fill="none"
          className="stroke-primary"
          strokeWidth={seg.bridge ? 1 : 2}
          strokeDasharray={seg.bridge ? "4 4" : undefined}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {crossing === null ? null : (
        <circle
          cx={s.x(dayNumber(crossing.day))}
          cy={s.y(crossing.value)}
          r={5}
          className="fill-accent"
        />
      )}
      {columns.map((c) => {
        const slice = list.slice(c.from, c.to);
        const a = slice[0];
        const b = slice.at(-1);
        if (a === undefined || b === undefined) return null;
        const x = s.x(dayNumber(list[c.from - 1]?.day ?? a.day));
        return (
          <rect
            key={a.day}
            x={x}
            y={0}
            width={Math.max(s.x(dayNumber(b.day)) - x, 0.5)}
            height={H}
            fill="transparent"
          >
            <title>{`${formatDay(a.day)} to ${formatDay(b.day)}: ${formatValue(a.value, measure)} to ${formatValue(b.value, measure)}`}</title>
          </rect>
        );
      })}
    </Frame>
  );
}
