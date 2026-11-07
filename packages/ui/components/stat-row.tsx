import type { ReactNode } from "react";
import { formatNumber } from "./format";

export interface StatDelta {
  /** PTU minus LIVE in the stat's own unit. */
  readonly value: number;
}

export interface StatRowProps {
  readonly label: string;
  /** null renders as an em dash: the pipeline could not produce it (CLAUDE.md section 2). */
  readonly value: number | string | null;
  readonly unit?: string | undefined;
  readonly digits?: 0 | 2 | undefined;
  /** Shown with an arrow glyph plus color, never color alone (system.md section 6). */
  readonly delta?: StatDelta | undefined;
}

export function StatRow({
  label,
  value,
  unit,
  digits = 0,
  delta,
}: StatRowProps) {
  const text =
    value === null
      ? "—"
      : typeof value === "number"
        ? formatNumber(value, digits)
        : value;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 text-ui">
      <dt className="text-secondary">{label}</dt>
      <dd className="flex items-baseline gap-2 font-mono text-primary">
        <span>{text}</span>
        {unit !== undefined && value !== null ? (
          <span className="text-caption text-secondary">{unit}</span>
        ) : null}
        {delta !== undefined && delta.value !== 0 ? (
          <span
            className={`text-caption ${delta.value > 0 ? "text-success" : "text-danger"}`}
            aria-label={`PTU ${delta.value > 0 ? "up" : "down"} ${formatNumber(Math.abs(delta.value), digits)}`}
          >
            {delta.value > 0 ? "↑" : "↓"}{" "}
            {formatNumber(Math.abs(delta.value), digits)}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** A list of StatRows. */
export function StatList({ children }: { readonly children: ReactNode }) {
  return <dl className="m-0">{children}</dl>;
}
