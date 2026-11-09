"use client";

import type { ReactNode } from "react";
import NextLink from "next/link";
import { DataTable, formatNumber } from "ui";
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
  /** The ship's plate for the register (ADR-020); null without media. */
  readonly plate: { readonly src: string; readonly srcSet: string } | null;
}

const dash = <span className="text-secondary">—</span>;
const num = (value: number | null): ReactNode =>
  value === null ? dash : formatNumber(value);
const dec = (value: number | null): ReactNode =>
  value === null ? dash : formatNumber(value, 2);

/**
 * The register (spec 02, "Ship index"; ADR-020): a fixed column set, sorted by name by default and
 * by any stat column on tap, each row opening on its plate and the name in the display face. Name
 * and cargo stay visible on phone; the rest expand.
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
            <span className="flex flex-col items-start gap-2">
              {row.plate === null ? null : (
                <img
                  src={row.plate.src}
                  srcSet={row.plate.srcSet}
                  sizes="114px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={114}
                  height={64}
                  className="hidden aspect-video h-16 w-auto shrink-0 border border-hairline-strong object-cover xl:block"
                />
              )}
              <NextLink
                href={row.href}
                className="whitespace-nowrap rounded-control text-heading text-primary no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {row.name}
              </NextLink>
            </span>
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
