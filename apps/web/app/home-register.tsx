"use client";

import NextLink from "next/link";
import { Badge, type BadgeTone, DataTable, formatNumber } from "ui";

/**
 * Every ship file on record (ADR-011, ADR-013), as the site's standard table (CLAUDE.md section 7):
 * fixed columns, sticky header, units in the header, sort on tap, and on phones the row expands
 * rather than the table scrolling sideways.
 */

export interface RegisterRow {
  readonly file: string;
  readonly name: string;
  readonly href: string;
  readonly maker: string;
  readonly role: string | null;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly length: number | null;
  readonly lengthDigits: 0 | 2;
  readonly crew: string | null;
  /** For sorting by crew: the most it carries. */
  readonly crewMax: number | null;
  /** The headline pledge price in US dollars (ADR-013), or null when none is on file. */
  readonly pledge: { readonly price: number; readonly onSale: boolean } | null;
  readonly thumb: { readonly src: string; readonly srcSet: string } | null;
}

export function Register({ rows }: { readonly rows: readonly RegisterRow[] }) {
  return (
    <DataTable
      caption="Ship files on record"
      rows={rows}
      rowKey={(row) => row.file}
      expandBelow="md"
      columns={[
        {
          key: "ship",
          header: "Ship",
          primary: true,
          sortValue: (row) => row.name,
          render: (row) => (
            <span className="flex items-center gap-3">
              {row.thumb === null ? null : (
                <img
                  src={row.thumb.src}
                  srcSet={row.thumb.srcSet}
                  sizes="96px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={96}
                  height={54}
                  className="hidden aspect-video w-24 shrink-0 rounded-control object-cover sm:block"
                />
              )}
              <span className="flex min-w-0 flex-col">
                <NextLink
                  href={row.href}
                  className="text-ui font-medium text-primary no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {row.name}
                </NextLink>
                <span className="font-mono text-caption text-secondary">
                  {row.file}
                </span>
              </span>
            </span>
          ),
        },
        {
          key: "maker",
          header: "Maker",
          sortValue: (row) => row.maker,
          render: (row) => row.maker,
        },
        {
          key: "role",
          header: "Role",
          sortValue: (row) => row.role,
          render: (row) => row.role ?? "Not stated",
        },
        {
          key: "status",
          header: "Status",
          sortValue: (row) => row.status.label,
          render: (row) => (
            <Badge tone={row.status.tone}>{row.status.label}</Badge>
          ),
        },
        {
          key: "length",
          header: "Length",
          unit: "m",
          align: "right",
          sortValue: (row) => row.length,
          render: (row) =>
            row.length === null
              ? "—"
              : formatNumber(row.length, row.lengthDigits),
        },
        {
          key: "crew",
          header: "Crew",
          align: "right",
          sortValue: (row) => row.crewMax,
          render: (row) => row.crew ?? "—",
        },
        {
          key: "pledge",
          header: "Pledge",
          unit: "USD",
          align: "right",
          sortValue: (row) => row.pledge?.price ?? null,
          render: (row) =>
            row.pledge === null ? (
              "—"
            ) : (
              <span className="whitespace-nowrap">
                {formatNumber(row.pledge.price)}
                {row.pledge.onSale ? null : (
                  <span className="block font-sans text-caption text-secondary">
                    Not on sale
                  </span>
                )}
              </span>
            ),
        },
      ]}
    />
  );
}
