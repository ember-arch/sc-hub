"use client";

import { DataTable, TextLink, formatDate, formatNumber } from "ui";

/**
 * The two Acquisition tables of the ship file (ADR-013): the ship's items on RSI's pledge store,
 * and the in-game shop terminals that sell or rent it as reported to UEX Corp. Plain rows in, so
 * the server builder never hands a function to the client.
 */

export interface PledgeRow {
  readonly key: string;
  readonly title: string;
  readonly kind: string;
  readonly price_usd: number;
  readonly warbond: boolean | null;
  readonly available: boolean;
  readonly observed_at: string;
  readonly url: string;
}

export function PledgeTable({ rows }: { readonly rows: readonly PledgeRow[] }) {
  return (
    <DataTable
      caption="Pledge store items for this ship"
      rows={rows}
      rowKey={(row) => row.key}
      defaultSort={{ key: "status", direction: "asc" }}
      columns={[
        {
          key: "item",
          header: "Item",
          render: (row) => (
            <TextLink href={row.url} external className="text-primary">
              {row.title}
            </TextLink>
          ),
          sortValue: (row) => row.title,
        },
        {
          key: "kind",
          header: "Kind",
          render: (row) => row.kind,
          sortValue: (row) => row.kind,
        },
        {
          key: "price",
          header: "Price",
          unit: "USD",
          align: "right",
          primary: true,
          render: (row) => (
            <span className="font-mono">{formatNumber(row.price_usd)}</span>
          ),
          sortValue: (row) => row.price_usd,
        },
        {
          key: "warbond",
          header: "Warbond",
          render: (row) =>
            row.warbond === null ? "Not stated" : row.warbond ? "Yes" : "No",
        },
        {
          key: "status",
          header: "Status",
          primary: true,
          render: (row) => (row.available ? "On sale" : "Not on sale"),
          sortValue: (row) => (row.available ? 0 : 1),
        },
        {
          key: "read",
          header: "Last read",
          align: "right",
          render: (row) => (
            <span className="font-mono">{formatDate(row.observed_at)}</span>
          ),
          sortValue: (row) => row.observed_at,
        },
      ]}
    />
  );
}

export interface ShopTableRow {
  readonly key: string;
  readonly terminal: string;
  readonly place: string | null;
  readonly system: string | null;
  readonly buy_auec: number | null;
  readonly rent_auec: number | null;
  readonly reported_at: string;
  readonly href: string | null;
}

const price = (value: number | null) =>
  value === null ? (
    <span className="text-muted">
      <span aria-hidden="true">–</span>
      <span className="sr-only">Not reported</span>
    </span>
  ) : (
    <span className="font-mono">{formatNumber(value)}</span>
  );

export function ShopTable({
  rows,
}: {
  readonly rows: readonly ShopTableRow[];
}) {
  return (
    <DataTable
      caption="In-game shop terminals that sell or rent this ship"
      rows={rows}
      rowKey={(row) => row.key}
      defaultSort={{ key: "buy", direction: "asc" }}
      expandBelow="lg"
      columns={[
        {
          key: "shop",
          header: "Shop",
          render: (row) =>
            row.href === null ? (
              row.terminal
            ) : (
              <TextLink href={row.href} external className="text-primary">
                {row.terminal}
              </TextLink>
            ),
          sortValue: (row) => row.terminal,
        },
        {
          key: "place",
          header: "Location",
          render: (row) => row.place ?? "Not stated",
          sortValue: (row) => row.place,
        },
        {
          key: "system",
          header: "System",
          render: (row) => row.system ?? "Not stated",
          sortValue: (row) => row.system,
        },
        {
          key: "buy",
          header: "Buy",
          unit: "aUEC",
          align: "right",
          primary: true,
          render: (row) => price(row.buy_auec),
          sortValue: (row) => row.buy_auec,
        },
        {
          key: "rent",
          header: "Rent",
          unit: "aUEC",
          align: "right",
          primary: true,
          render: (row) => price(row.rent_auec),
          sortValue: (row) => row.rent_auec,
        },
        {
          key: "reported",
          header: "Reported",
          align: "right",
          render: (row) => (
            <span className="font-mono">{formatDate(row.reported_at)}</span>
          ),
          sortValue: (row) => row.reported_at,
        },
      ]}
    />
  );
}
