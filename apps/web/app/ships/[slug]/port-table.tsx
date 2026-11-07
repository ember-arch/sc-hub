"use client";

import { Fragment } from "react";
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

/** Nesting indents by one spacing step per level, capped at the deepest the game produces. */
const INDENT = ["", "pl-3", "pl-6", "pl-12"] as const;

/**
 * Game port names are long and underscore-joined. A break opportunity after each underscore lets
 * a phone wrap `hardpoint_cooler_left` at its parts instead of mid-word or sideways.
 */
function PortName({ name }: { readonly name: string }) {
  const parts = name.split("_");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <>
              _<wbr />
            </>
          ) : null}
          {part}
        </Fragment>
      ))}
    </>
  );
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
              className={`block wrap-anywhere font-mono text-caption text-secondary ${INDENT[Math.min(row.depth, INDENT.length - 1)]} ${row.depth > 0 ? "border-l border-hairline" : ""}`}
            >
              <PortName name={row.name} />
            </span>
          ),
        },
        {
          key: "type",
          header: "Type",
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
