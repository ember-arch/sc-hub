import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState, FilterBar, FilterSelect, TextLink } from "ui";
import {
  MAX_COMPARE,
  compareHref,
  parseCompare,
  withShip,
} from "../../lib/compare";
import { compareColumns, compareGroups } from "../../lib/compare-view";
import { type ShipView, repo } from "../../lib/data";
import type { Query } from "../../lib/ship-filters";
import { Site } from "../../lib/site";
import { resolveSlugs } from "../../lib/slugs";
import { SyncCompareBasket } from "./compare-controls";
import { PriceCredit } from "../price-credit";
import { CompareTable } from "./compare-table";

export const metadata: Metadata = {
  title: "Compare ships",
  alternates: { canonical: "/compare" },
  description:
    "Up to four Star Citizen ships side by side: crew, cargo, dimensions, mass, speed and status by game version.",
  // Every selection is its own URL; the pages are for sharing, not for search engines.
  robots: { index: false, follow: true },
};

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Compare (spec 02): `/compare?ships=a,b,c,d`, up to four ships side by side on the key-facts set
 * and the full stats table; shareable by URL. The URL is the truth: adding a ship here redirects
 * to the URL with it appended, removing is a link without it, and the client-side basket that
 * the ship page and the index feed follows whatever URL is open.
 */
export default async function ComparePage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const r = repo();
  const parsed = parseCompare(query["ships"]);
  // An old slug from slug_history in a shared link lands on the current ship (spec 02, "Slugs and redirects").
  const resolved = resolveSlugs(
    r.ships.map((s) => s.vehicle),
    parsed.slugs,
  );
  if (resolved.moved) redirect(compareHref(resolved.slugs));
  const slugs = resolved.slugs;
  const dropped = parsed.dropped;
  const add = first(query["add"])?.trim();
  if (add !== undefined && add !== "" && r.shipBySlug(add) !== undefined) {
    const next = withShip(slugs, add);
    if (next !== slugs) redirect(compareHref(next));
  }
  const ships = slugs
    .map((slug) => r.shipBySlug(slug))
    .filter((s): s is ShipView => s !== undefined);
  const unknown = slugs.filter((slug) => r.shipBySlug(slug) === undefined);
  const chosen = ships.map((s) => s.vehicle.slug);
  const others = r.entries.filter((s) => !chosen.includes(s.vehicle.slug));

  return (
    <Site current="ships">
      <SyncCompareBasket slugs={chosen} />
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-title text-primary">Compare ships</h1>
          <p
            className="text-caption text-secondary"
            data-testid="compare-count"
          >
            {ships.length} of {MAX_COMPARE} ships ·{" "}
            {r.liveVersion === null ? "no LIVE build" : `LIVE ${r.liveVersion}`}
          </p>
        </div>
        {unknown.length > 0 ? (
          <p className="m-0 text-caption text-secondary">
            No ship named {unknown.join(", ")};{" "}
            {unknown.length === 1 ? "it was" : "they were"} left out.
          </p>
        ) : null}
        {dropped.length > 0 ? (
          <p className="m-0 text-caption text-secondary">
            Up to {MAX_COMPARE} ships can be compared; {dropped.join(", ")}{" "}
            {dropped.length === 1 ? "was" : "were"} left out.
          </p>
        ) : null}
        {ships.length === 0 ? (
          <EmptyState>
            No ships selected. Add one below, or use Compare on a ship page or
            the <TextLink href="/ships">ship index</TextLink>.
          </EmptyState>
        ) : (
          <CompareTable
            columns={compareColumns(ships)}
            groups={compareGroups(ships)}
            version={r.liveVersion}
          />
        )}
        {ships.length === 0 ? null : <PriceCredit />}
        {ships.length < MAX_COMPARE && others.length > 0 ? (
          <FilterBar
            action="/compare"
            label="Add a ship to the comparison"
            hidden={
              chosen.length === 0 ? undefined : { ships: chosen.join(",") }
            }
          >
            <FilterSelect
              key={chosen.join(",")}
              name="add"
              label="Add a ship"
              allLabel="Choose a ship"
              value=""
              options={others.map((s) => ({
                value: s.vehicle.slug,
                label: s.vehicle.name,
              }))}
            />
          </FilterBar>
        ) : null}
      </div>
    </Site>
  );
}
