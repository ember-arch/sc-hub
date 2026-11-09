"use client";

import { type ReactNode, useId, useState } from "react";

/**
 * system.md principle 6: fixed column set, sticky header, unit in the header, sort on tap, and
 * below the table's breakpoint (`expandBelow`, md by default) the row expands instead of the
 * table scrolling sideways. Columns marked `primary` stay visible there; the rest show inside the
 * expanded row, and a "Sort by" select keeps every sortable column sortable (ADR-007).
 */

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly unit?: string | undefined;
  readonly align?: "left" | "right" | undefined;
  /** Visible on phone without expanding. The first column is always primary. */
  readonly primary?: boolean | undefined;
  readonly render: (row: T) => ReactNode;
  /** Enables sorting; null sorts last. */
  readonly sortValue?: ((row: T) => number | string | null) | undefined;
}

export interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  readonly defaultSort?:
    { readonly key: string; readonly direction: "asc" | "desc" } | undefined;
  /**
   * Below this breakpoint rows expand instead of showing every column. `md` suits a few columns;
   * a wide table (the ships table's eleven) needs `xl` or it scrolls sideways between 768 px and
   * the width it fits in (system.md principle 6).
   */
  readonly expandBelow?: "md" | "lg" | "xl" | undefined;
  /**
   * Header text may wrap and the unit sits on its own line under it, so a wide table (the ships
   * table with prices, ADR-013) fits the page instead of scrolling sideways.
   */
  readonly unitsBelow?: boolean | undefined;
}

type Direction = "asc" | "desc";

/** Literal class names per breakpoint, so Tailwind's scanner sees each one. */
const BREAKPOINT = {
  md: { cell: "hidden md:table-cell", phone: "md:hidden" },
  lg: { cell: "hidden lg:table-cell", phone: "lg:hidden" },
  xl: { cell: "hidden xl:table-cell", phone: "xl:hidden" },
} as const;

function compare(a: number | string | null, b: number | string | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en");
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  defaultSort,
  expandBelow = "md",
  unitsBelow = false,
}: DataTableProps<T>) {
  const bp = BREAKPOINT[expandBelow];
  const sortId = useId();
  const [sort, setSort] = useState<{
    key: string;
    direction: Direction;
  } | null>(defaultSort ?? null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const sortColumn =
    sort === null ? undefined : columns.find((c) => c.key === sort.key);
  const sorted =
    sortColumn?.sortValue === undefined
      ? rows
      : [...rows].sort((a, b) => {
          const value = sortColumn.sortValue;
          if (value === undefined) return 0;
          const result = compare(value(a), value(b));
          return sort?.direction === "desc" ? -result : result;
        });

  const toggleSort = (column: Column<T>): void => {
    if (column.sortValue === undefined) return;
    setSort((current) =>
      current?.key === column.key
        ? {
            key: column.key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key: column.key, direction: "asc" },
    );
  };

  const toggleRow = (key: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isPrimary = (column: Column<T>, index: number): boolean =>
    index === 0 || column.primary === true;
  const secondary = columns.filter((c, i) => !isPrimary(c, i));
  const cellAlign = (column: Column<T>): string =>
    column.align === "right" ? "text-right" : "text-left";
  const sortable = columns.filter((c) => c.sortValue !== undefined);
  const hiddenSortable = secondary.some((c) => c.sortValue !== undefined);
  const heading = (c: Column<T>): string =>
    c.unit === undefined ? c.header : `${c.header} (${c.unit})`;
  const order = (c: Column<T>, direction: Direction): string =>
    c.align === "right"
      ? direction === "asc"
        ? "low to high"
        : "high to low"
      : direction === "asc"
        ? "A to Z"
        : "Z to A";

  const table = (
    <table className="w-full border-collapse text-ui">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column, index) => {
            const active = sort?.key === column.key;
            const ariaSort = active
              ? sort?.direction === "asc"
                ? "ascending"
                : "descending"
              : undefined;
            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSort}
                className={`sticky top-0 border-b border-hairline bg-inset px-3 py-2 text-caption text-secondary ${cellAlign(column)} ${isPrimary(column, index) ? "" : bp.cell}`}
              >
                {column.sortValue === undefined ? (
                  <span className="whitespace-nowrap">
                    {column.header}
                    {column.unit !== undefined ? (
                      <span className="text-secondary"> ({column.unit})</span>
                    ) : null}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSort(column)}
                    className={`inline-flex items-center gap-x-1 rounded-control hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${unitsBelow ? `flex-wrap ${column.align === "right" ? "justify-end" : ""}` : "whitespace-nowrap"}`}
                  >
                    {column.header}
                    {column.unit !== undefined && !unitsBelow ? (
                      <span className="text-secondary">({column.unit})</span>
                    ) : null}
                    <span aria-hidden="true" className="text-secondary">
                      {active ? (sort?.direction === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                    {column.unit !== undefined && unitsBelow ? (
                      <span className="basis-full text-secondary">
                        ({column.unit})
                      </span>
                    ) : null}
                  </button>
                )}
              </th>
            );
          })}
          {secondary.length > 0 ? (
            <th
              scope="col"
              className={`sticky top-0 border-b border-hairline bg-inset ${bp.phone}`}
            >
              <span className="sr-only">More</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => {
          const key = rowKey(row);
          const open = expanded.has(key);
          return (
            <RowGroup key={key} open={open}>
              <tr className="border-b border-hairline">
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={`break-words px-3 py-2 align-top ${cellAlign(column)} ${isPrimary(column, index) ? "" : bp.cell} ${column.align === "right" ? "font-mono" : ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {secondary.length > 0 ? (
                  <td className={`px-3 py-2 text-right ${bp.phone}`}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleRow(key)}
                      className="rounded-control px-2 py-1 text-caption text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {open ? "Less" : "More"}
                    </button>
                  </td>
                ) : null}
              </tr>
              {open ? (
                <tr className={`border-b border-hairline ${bp.phone}`}>
                  <td colSpan={columns.length + 1} className="px-3 py-2">
                    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2">
                      {secondary.map((column) => (
                        <div key={column.key} className="flex flex-col">
                          <dt className="text-caption text-secondary">
                            {column.header}
                            {column.unit !== undefined
                              ? ` (${column.unit})`
                              : ""}
                          </dt>
                          <dd
                            className={`m-0 ${column.align === "right" ? "font-mono" : ""}`}
                          >
                            {column.render(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                </tr>
              ) : null}
            </RowGroup>
          );
        })}
      </tbody>
    </table>
  );

  if (!hiddenSortable) return table;
  return (
    <div className="flex flex-col gap-3">
      {/* Hidden columns cannot be tapped to sort, so the same sort is offered here. */}
      <div className={`flex items-center gap-2 ${bp.phone}`}>
        <label htmlFor={sortId} className="text-caption text-secondary">
          Sort by
        </label>
        <select
          id={sortId}
          value={sort === null ? "" : `${sort.key}:${sort.direction}`}
          onChange={(event) => {
            const [key, direction] = event.currentTarget.value.split(":");
            if (
              key !== undefined &&
              (direction === "asc" || direction === "desc")
            ) {
              setSort({ key, direction });
            }
          }}
          className="rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {sort === null ? <option value="">Unsorted</option> : null}
          {sortable.flatMap((c) =>
            (["asc", "desc"] as const).map((direction) => (
              <option
                key={`${c.key}:${direction}`}
                value={`${c.key}:${direction}`}
              >
                {heading(c)}, {order(c, direction)}
              </option>
            )),
          )}
        </select>
      </div>
      {table}
    </div>
  );
}

/** Keeps a row and its expansion adjacent without an extra tbody per row. */
function RowGroup({
  children,
}: {
  readonly open: boolean;
  readonly children: ReactNode;
}) {
  return <>{children}</>;
}
