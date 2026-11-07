"use client";

import { useId, useState } from "react";
import { EmptyState } from "./entity-page";
import { StatList, StatRow } from "./stat-row";

/**
 * Specs by channel with the PTU diff toggle (spec 02, "Ship page" and "PTU diff toggle"). LIVE
 * values are always shown; when a PTU build is current and differs, a toggle reveals each PTU
 * value as a delta beside the LIVE value, with an arrow glyph and color, never color alone
 * (`StatRow`). The same component serves ship specs and component stats; the page computes the
 * deltas, this only shows them.
 */

export interface ChannelStatRow {
  readonly key: string;
  readonly label: string;
  readonly value: number | string | null;
  readonly unit?: string | undefined;
  readonly digits?: 0 | 2 | undefined;
  /** PTU minus LIVE; absent when PTU equals LIVE or either side is missing. */
  readonly delta?: number | undefined;
}

export interface StatsByChannelProps {
  readonly rows: readonly ChannelStatRow[];
  /** The current PTU build, or null when none is recorded. */
  readonly ptuVersion: string | null;
  /** True when the PTU pack has a row for this entity. */
  readonly hasPtuRow: boolean;
  /** Stories only: render with the differences shown. */
  readonly initialOpen?: boolean | undefined;
}

export function StatsByChannel({
  rows,
  ptuVersion,
  hasPtuRow,
  initialOpen,
}: StatsByChannelProps) {
  const [showPtu, setShowPtu] = useState(initialOpen === true);
  const noteId = useId();
  const changed = rows.filter((row) => row.delta !== undefined).length;
  const half = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, half), rows.slice(half)];

  return (
    <div className="flex flex-col gap-4">
      {ptuVersion !== null && hasPtuRow && changed > 0 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <button
            type="button"
            aria-pressed={showPtu}
            aria-describedby={noteId}
            onClick={() => setShowPtu((v) => !v)}
            className="rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary transition-colors duration-hover hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {showPtu ? "Hide PTU differences" : "Show PTU differences"}
          </button>
          <p id={noteId} className="m-0 text-caption text-secondary">
            {changed} of {rows.length} values differ in PTU {ptuVersion};
            differences are PTU minus LIVE
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        {columns.map((column, i) => (
          <StatList key={i}>
            {column.map((row) => (
              <StatRow
                key={row.key}
                label={row.label}
                value={row.value}
                unit={row.unit}
                digits={row.digits}
                delta={
                  showPtu && row.delta !== undefined
                    ? { value: row.delta }
                    : undefined
                }
              />
            ))}
          </StatList>
        ))}
      </div>
      {ptuVersion === null ? (
        <p className="m-0 text-caption text-secondary">
          No PTU build is on record. When one is, its values appear here as
          differences from LIVE.
        </p>
      ) : !hasPtuRow ? (
        <p className="m-0 text-caption text-secondary">
          PTU {ptuVersion} has no row for this entry.
        </p>
      ) : changed === 0 ? (
        <EmptyState>No PTU differences for this version.</EmptyState>
      ) : null}
    </div>
  );
}
