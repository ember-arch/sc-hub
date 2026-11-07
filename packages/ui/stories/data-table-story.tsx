"use client";

import type { Item } from "schema";
import { DataTable } from "../components/data-table";
import { sentence } from "../components/format";

/**
 * DataTable takes render functions, which a server component cannot hand to a client component,
 * so the story builds its columns on the client from plain item rows.
 */
export function DataTableStory({
  items,
  phone,
}: {
  readonly items: readonly Item[];
  readonly phone?: boolean | undefined;
}) {
  return (
    <DataTable
      caption="Components"
      rows={items}
      rowKey={(item) => item.class_name}
      defaultSort={
        phone === true ? undefined : { key: "name", direction: "asc" }
      }
      columns={[
        {
          key: "name",
          header: "Name",
          render: (i) => i.name,
          sortValue: (i) => i.name,
        },
        {
          key: "type",
          header: "Type",
          render: (i) => sentence(i.type),
          sortValue: (i) => i.type,
        },
        {
          key: "size",
          header: "Size",
          align: "right",
          primary: true,
          render: (i) => i.size,
          sortValue: (i) => i.size,
        },
        {
          key: "grade",
          header: "Grade",
          align: "right",
          render: (i) => i.grade ?? "—",
          sortValue: (i) => i.grade,
        },
        {
          key: "class",
          header: "Class",
          render: (i) => (i.item_class === null ? "—" : sentence(i.item_class)),
          sortValue: (i) => i.item_class,
        },
      ]}
    />
  );
}
