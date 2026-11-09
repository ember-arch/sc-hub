import { formatNumber } from "./format";

/**
 * Where one ship sits among the others on record for one stat (ADR-008): a hairline track from
 * the lowest to the highest value, a mark for every other ship, the page's ship in the accent with
 * its value and rank in words. A log scale for stats that span orders of magnitude (mass, hull),
 * named under the track so the distances are not misread.
 */

export interface RankValue {
  readonly key: string;
  readonly name: string;
  readonly value: number;
  readonly current?: boolean | undefined;
}

export interface RankBarProps {
  readonly label: string;
  readonly unit?: string | undefined;
  readonly digits?: 0 | 2 | undefined;
  readonly values: readonly RankValue[];
  readonly scale?: "linear" | "log" | undefined;
  /** Words for first place, for example "Fastest" or "Heaviest". */
  readonly most: string;
}

const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

export function rankOf(values: readonly RankValue[]): number {
  const current = values.find((v) => v.current === true);
  if (current === undefined) return 0;
  return values.filter((v) => v.value > current.value).length + 1;
}

export function RankBar({
  label,
  unit,
  digits = 0,
  values,
  scale = "linear",
  most,
}: RankBarProps) {
  const current = values.find((v) => v.current === true);
  if (current === undefined || values.length < 2) return null;
  const f = (v: number): number =>
    scale === "log" ? Math.log10(Math.max(v, 1)) : v;
  const lo = Math.min(...values.map((v) => f(v.value)));
  const hi = Math.max(...values.map((v) => f(v.value)));
  const at = (v: number): number =>
    hi === lo ? 50 : ((f(v) - lo) / (hi - lo)) * 100;
  const rank = rankOf(values);
  const words =
    rank === 1
      ? `${most} of the ${values.length} ships on record`
      : `${ordinal(rank)} of ${values.length}`;
  return (
    <div className="flex flex-col gap-2 border-b border-hairline py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-ui text-secondary">{label}</span>
        <span className="text-ui text-primary">
          <span className="font-mono">
            {formatNumber(current.value, digits)}
          </span>
          {unit === undefined ? null : (
            <span className="text-caption text-secondary"> {unit}</span>
          )}
          <span className="text-caption text-secondary"> · {words}</span>
        </span>
      </div>
      <div className="relative py-2" aria-hidden="true">
        <div className="border-t border-hairline" />
        {values.map((v) => (
          <svg
            key={v.key}
            width={v.current === true ? 14 : 8}
            height={v.current === true ? 14 : 8}
            viewBox="0 0 14 14"
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${at(v.value)}%` }}
          >
            <circle
              cx={7}
              cy={7}
              r={v.current === true ? 6 : 5}
              className={
                v.current === true
                  ? "fill-accent stroke-page"
                  : "fill-page stroke-secondary"
              }
              strokeWidth={v.current === true ? 2 : 1.5}
            />
          </svg>
        ))}
      </div>
      <div className="flex justify-between text-caption text-secondary">
        <span className="font-mono">
          {formatNumber(Math.min(...values.map((v) => v.value)), digits)}
        </span>
        {scale === "log" ? <span>log scale</span> : null}
        <span className="font-mono">
          {formatNumber(Math.max(...values.map((v) => v.value)), digits)}
        </span>
      </div>
    </div>
  );
}
