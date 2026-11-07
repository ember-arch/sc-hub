import type { ReactNode } from "react";
import { TextLink, formatNumber } from "ui";

export interface CompareColumn {
  readonly slug: string;
  readonly name: string;
  readonly href: string;
  /** Where "Remove" goes: the compare URL without this ship. */
  readonly removeHref: string;
}

export interface CompareRow {
  readonly key: string;
  readonly label: string;
  readonly unit?: string | undefined;
  readonly digits?: 0 | 2 | undefined;
  /** One value per column, in column order; null renders as an em dash. */
  readonly values: readonly (number | string | null)[];
}

export interface CompareGroup {
  readonly title: string;
  readonly rows: readonly CompareRow[];
}

const dash = <span className="text-secondary">—</span>;

function cell(row: CompareRow, value: number | string | null): ReactNode {
  if (value === null) return dash;
  return (
    <>
      <span className={typeof value === "number" ? "font-mono" : ""}>
        {typeof value === "number" ? formatNumber(value, row.digits) : value}
      </span>
      {row.unit !== undefined ? (
        <span className="text-caption text-secondary"> {row.unit}</span>
      ) : null}
    </>
  );
}

/**
 * Ships side by side (spec 02, "Compare"). On md and up a table with one column per ship, a
 * sticky header of ship names and units in the row labels. On phone each stat becomes a block
 * with the ships' values in a two-column grid, so the page never scrolls sideways (system.md
 * principle 6). Both renderings are server-rendered; one is hidden per breakpoint.
 */
export function CompareTable({
  columns,
  groups,
}: {
  readonly columns: readonly CompareColumn[];
  readonly groups: readonly CompareGroup[];
}) {
  return (
    <>
      <table className="hidden w-full border-collapse text-ui md:table">
        <caption className="sr-only">Ships compared</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 border-b border-hairline bg-inset px-3 py-2 text-left text-caption text-secondary"
            >
              Stat
            </th>
            {columns.map((column) => (
              <th
                key={column.slug}
                scope="col"
                className="sticky top-0 border-b border-hairline bg-inset px-3 py-2 text-right text-caption"
              >
                <span className="flex flex-col items-end gap-1">
                  <TextLink href={column.href}>{column.name}</TextLink>
                  <TextLink
                    href={column.removeHref}
                    className="text-secondary"
                    aria-label={`Remove ${column.name} from the comparison`}
                  >
                    Remove
                  </TextLink>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.title} group={group} columns={columns} />
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-8 md:hidden">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui">
          {columns.map((column) => (
            <li
              key={column.slug}
              className="flex items-baseline justify-between gap-4"
            >
              <TextLink href={column.href}>{column.name}</TextLink>
              <TextLink href={column.removeHref} className="text-secondary">
                Remove
              </TextLink>
            </li>
          ))}
        </ul>
        {groups.map((group) => (
          <section
            key={group.title}
            aria-label={group.title}
            className="flex flex-col gap-4"
          >
            <h3 className="text-ui font-medium text-primary">{group.title}</h3>
            {group.rows.map((row) => (
              <dl
                key={row.key}
                className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 border-b border-hairline pb-3"
              >
                <dt className="col-span-2 text-caption text-secondary">
                  {row.label}
                  {row.unit !== undefined ? ` (${row.unit})` : ""}
                </dt>
                {columns.map((column, i) => (
                  <dd key={column.slug} className="m-0 flex flex-col">
                    <span className="text-caption text-secondary">
                      {column.name}
                    </span>
                    <span className="text-primary">
                      {cell({ ...row, unit: undefined }, row.values[i] ?? null)}
                    </span>
                  </dd>
                ))}
              </dl>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

function GroupRows({
  group,
  columns,
}: {
  readonly group: CompareGroup;
  readonly columns: readonly CompareColumn[];
}) {
  return (
    <>
      <tr>
        <th
          scope="rowgroup"
          colSpan={columns.length + 1}
          className="border-b border-hairline px-3 pb-2 pt-6 text-left text-ui font-medium text-primary"
        >
          {group.title}
        </th>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.key} className="border-b border-hairline">
          <th
            scope="row"
            className="px-3 py-2 text-left font-regular text-secondary"
          >
            {row.label}
            {row.unit !== undefined ? (
              <span className="text-caption"> ({row.unit})</span>
            ) : null}
          </th>
          {columns.map((column, i) => (
            <td
              key={column.slug}
              className="px-3 py-2 text-right align-top text-primary"
            >
              {cell({ ...row, unit: undefined }, row.values[i] ?? null)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
