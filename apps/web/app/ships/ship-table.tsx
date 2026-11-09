"use client";

import type { ReactNode } from "react";
import { DataTable, TextLink, formatNumber } from "ui";
import { CompareToggle } from "../compare/compare-controls";

export interface ShipRow {
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly href: string;
  readonly manufacturer: string;
  readonly role: string | null;
  readonly size: string | null;
  /** Position in the documented size order, for sorting the size column. */
  readonly sizeRank: number;
  readonly crew: string | null;
  /** Numeric for sorting; the crew column shows `crew`. */
  readonly crewMax: number | null;
  readonly cargo: number | null;
  readonly length: number | null;
  readonly mass: number | null;
  readonly scmSpeed: number | null;
  /** The headline pledge price (ADR-013) and whether it is on sale. */
  readonly pledge: number | null;
  readonly pledgeOnSale: boolean;
  /** The lowest in-game purchase price reported to UEX. */
  readonly buy: number | null;
  readonly status: string;
}

const dash = <span className="text-secondary">—</span>;
const num = (value: number | null): ReactNode =>
  value === null ? dash : formatNumber(value);
const dec = (value: number | null): ReactNode =>
  value === null ? dash : formatNumber(value, 2);

/**
 * Table mode of the ships index (spec 02, "Ship index"): a fixed column set, sorted by name by
 * default and by any stat column on tap. Name and cargo stay visible on phone; the rest expand.
 * The caption names the build the numbers come from for readers who do not see the count line.
 */
export function ShipTable({
  rows,
  version,
}: {
  readonly rows: readonly ShipRow[];
  readonly version: string | null;
}) {
  return (
    <DataTable
      caption={version === null ? "Ships" : `Ships, LIVE ${version}`}
      rows={rows}
      rowKey={(row) => row.key}
      defaultSort={{ key: "name", direction: "asc" }}
      expandBelow="xl"
      unitsBelow
      columns={[
        {
          key: "name",
          header: "Name",
          render: (row) => (
            <TextLink href={row.href} className="whitespace-nowrap">
              {row.name}
            </TextLink>
          ),
          sortValue: (row) => row.name,
        },
        {
          key: "manufacturer",
          header: "Manufacturer",
          render: (row) => row.manufacturer,
          sortValue: (row) => row.manufacturer,
        },
        {
          key: "role",
          header: "Role",
          render: (row) => row.role ?? dash,
          sortValue: (row) => row.role,
        },
        {
          key: "size",
          header: "Size",
          render: (row) => row.size ?? dash,
          sortValue: (row) => row.sizeRank,
        },
        {
          key: "crew",
          header: "Crew",
          align: "right",
          render: (row) => row.crew ?? dash,
          sortValue: (row) => row.crewMax,
        },
        {
          key: "cargo",
          header: "Cargo",
          unit: "SCU",
          align: "right",
          primary: true,
          render: (row) => num(row.cargo),
          sortValue: (row) => row.cargo,
        },
        {
          key: "length",
          header: "Length",
          unit: "m",
          align: "right",
          render: (row) => dec(row.length),
          sortValue: (row) => row.length,
        },
        {
          key: "mass",
          header: "Mass",
          unit: "kg",
          align: "right",
          render: (row) => num(row.mass),
          sortValue: (row) => row.mass,
        },
        {
          key: "scm",
          header: "SCM speed",
          unit: "m/s",
          align: "right",
          render: (row) => num(row.scmSpeed),
          sortValue: (row) => row.scmSpeed,
        },
        {
          key: "pledge",
          header: "Pledge",
          unit: "USD",
          align: "right",
          render: (row) =>
            row.pledge === null ? (
              dash
            ) : (
              <>
                {formatNumber(row.pledge)}
                {row.pledgeOnSale ? null : (
                  <span className="block font-sans text-caption text-secondary">
                    Not on sale
                  </span>
                )}
              </>
            ),
          sortValue: (row) => row.pledge,
        },
        {
          key: "buy",
          header: "Buy in game",
          unit: "aUEC",
          align: "right",
          render: (row) => num(row.buy),
          sortValue: (row) => row.buy,
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <span className="whitespace-nowrap">{row.status}</span>
          ),
          sortValue: (row) => row.status,
        },
        {
          key: "compare",
          header: "Compare",
          render: (row) => <CompareToggle slug={row.slug} name={row.name} />,
        },
      ]}
    />
  );
}
