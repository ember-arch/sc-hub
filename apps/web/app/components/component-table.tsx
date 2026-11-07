"use client";

import { DataTable, TextLink } from "ui";

export interface ComponentRow {
  readonly key: string;
  readonly name: string;
  readonly href: string;
  readonly manufacturer: string;
  readonly size: number;
  readonly grade: string | null;
  readonly itemClass: string | null;
}

export function ComponentTable({
  caption,
  rows,
}: {
  readonly caption: string;
  readonly rows: readonly ComponentRow[];
}) {
  return (
    <DataTable
      caption={caption}
      rows={rows}
      rowKey={(row) => row.key}
      defaultSort={{ key: "name", direction: "asc" }}
      columns={[
        {
          key: "name",
          header: "Name",
          render: (row) => <TextLink href={row.href}>{row.name}</TextLink>,
          sortValue: (row) => row.name,
        },
        {
          key: "manufacturer",
          header: "Manufacturer",
          render: (row) => row.manufacturer,
          sortValue: (row) => row.manufacturer,
        },
        {
          key: "size",
          header: "Size",
          align: "right",
          primary: true,
          render: (row) => row.size,
          sortValue: (row) => row.size,
        },
        {
          key: "grade",
          header: "Grade",
          align: "right",
          render: (row) => row.grade ?? "—",
          sortValue: (row) => row.grade,
        },
        {
          key: "class",
          header: "Class",
          render: (row) => row.itemClass ?? "—",
          sortValue: (row) => row.itemClass,
        },
      ]}
    />
  );
}
