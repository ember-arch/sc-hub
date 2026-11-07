"use client";

import { DataTable, TextLink } from "ui";

export interface PortRow {
  readonly key: string;
  readonly depth: number;
  readonly name: string;
  readonly type: string;
  readonly sizeMin: number;
  readonly sizeMax: number;
  readonly item: { readonly name: string; readonly href: string } | null;
  readonly position: string | null;
}

/** Hardpoints as a DataTable: nested ports indent under their parent; each stock item links to its page. */
export function PortTable({ rows }: { readonly rows: readonly PortRow[] }) {
  return (
    <DataTable
      caption="Hardpoints and stock loadout"
      rows={rows}
      rowKey={(row) => row.key}
      columns={[
        {
          key: "port",
          header: "Port",
          render: (row) => (
            <span
              className={`break-all font-mono text-caption text-secondary ${row.depth > 0 ? "inline-block border-l border-hairline" : ""}`}
              style={
                row.depth > 0
                  ? { paddingLeft: `${row.depth * 12}px` }
                  : undefined
              }
            >
              {row.name}
            </span>
          ),
        },
        {
          key: "type",
          header: "Type",
          primary: true,
          render: (row) => row.type,
          sortValue: (row) => row.type,
        },
        {
          key: "size",
          header: "Size",
          align: "right",
          render: (row) =>
            row.sizeMin === row.sizeMax
              ? row.sizeMax
              : `${row.sizeMin}–${row.sizeMax}`,
          sortValue: (row) => row.sizeMax,
        },
        {
          key: "item",
          header: "Stock item",
          primary: true,
          render: (row) =>
            row.item === null ? (
              <span className="text-secondary">—</span>
            ) : (
              <TextLink href={row.item.href}>{row.item.name}</TextLink>
            ),
          sortValue: (row) => row.item?.name ?? null,
        },
        {
          key: "position",
          header: "Position",
          render: (row) => row.position ?? "—",
        },
      ]}
    />
  );
}
