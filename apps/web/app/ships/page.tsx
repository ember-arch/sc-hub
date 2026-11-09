import type { Metadata } from "next";
import {
  Card,
  EmptyState,
  FilterBar,
  FilterSelect,
  SegmentedLinks,
  TextLink,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { repo } from "../../lib/data";
import {
  SHIP_FACETS,
  type Query,
  type ShipFacet,
  applyShipFilters,
  hasShipFilters,
  parseShipQuery,
  shipFacetOptions,
  shipIndexHref,
} from "../../lib/ship-filters";
import { Site } from "../../lib/site";
import { crewRange, shipCard, shipRows } from "../../lib/views";
import { conceptShips, showcaseFor } from "../../lib/showcase";
import { CompareLink, CompareToggle } from "../compare/compare-controls";
import { PriceCredit } from "../price-credit";
import { ShipTable } from "./ship-table";
import { shipCardImage } from "../../lib/media";

// The canonical is the unfiltered index: filters are views of one page, not pages of their own.
export const metadata: Metadata = {
  title: "Ships",
  alternates: { canonical: "/ships" },
  description:
    "Every Star Citizen ship and vehicle with crew, cargo, dimensions and status by game version; filter by manufacturer, role, size and status.",
};

const FACET_LABELS: Readonly<
  Record<ShipFacet, { readonly label: string; readonly all: string }>
> = {
  manufacturer: { label: "Manufacturer", all: "All manufacturers" },
  role: { label: "Role", all: "All roles" },
  size: { label: "Size", all: "All sizes" },
  status: { label: "Status", all: "All statuses" },
  kind: { label: "Kind", all: "Ships and vehicles" },
};

/**
 * Ships index (spec 02, "Ship index"): filters as URL state, card and table views, sorted by name
 * by default and by any stat column in table mode.
 */
export default async function ShipsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  const r = repo();
  const state = parseShipQuery(await searchParams);
  const ships = applyShipFilters(r.ships, state.filters);
  // Concept ships sit outside the filters: they have no game data to filter on (ADR-010).
  const concepts = hasShipFilters(state.filters) ? [] : conceptShips();
  const options = shipFacetOptions(r.ships, {
    status: (status) => vehicleStatusBadge(status).label,
    kind: sentence,
    size: sentence,
  });
  const filtered = hasShipFilters(state.filters);
  const clearHref = shipIndexHref({ filters: {}, view: state.view });
  const viewHref = (view: "cards" | "table"): string =>
    shipIndexHref({ filters: state.filters, view });

  return (
    <Site current="ships">
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-title text-primary">Ships</h1>
          <div className="flex flex-wrap items-baseline gap-4">
            <CompareLink />
            <p className="text-caption text-secondary" data-testid="ship-count">
              {filtered
                ? `${ships.length} of ${r.ships.length} ships`
                : `${r.ships.length} ships`}{" "}
              · {r.liveVersion ?? "no LIVE build"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <FilterBar
            action="/ships"
            label="Filter ships"
            hidden={state.view === "table" ? { view: "table" } : undefined}
            clearHref={filtered ? clearHref : undefined}
          >
            {SHIP_FACETS.map((facet) => (
              <FilterSelect
                key={facet}
                name={facet}
                label={FACET_LABELS[facet].label}
                allLabel={FACET_LABELS[facet].all}
                value={state.filters[facet] ?? ""}
                options={options[facet]}
              />
            ))}
          </FilterBar>
          <div className="self-start md:self-end">
            <SegmentedLinks
              label="View"
              current={viewHref(state.view)}
              links={[
                { href: viewHref("cards"), label: "Cards" },
                { href: viewHref("table"), label: "Table" },
              ]}
            />
          </div>
        </div>
        {ships.length === 0 ? (
          <EmptyState>
            No ships match these filters.{" "}
            <TextLink href={clearHref}>Clear filters</TextLink> to see every
            ship.
          </EmptyState>
        ) : state.view === "table" ? (
          <div className="flex flex-col gap-3">
            <ShipTable rows={shipRows(ships)} version={r.liveVersion} />
            <PriceCredit />
          </div>
        ) : (
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
            {ships.map((ship, index) => (
              <li key={ship.vehicle.class_name} className="flex flex-col gap-2">
                <Card
                  {...shipCard(ship, shipCardImage(ship))}
                  imageLoading={index === 0 ? "high" : "lazy"}
                />
                <div className="flex justify-end">
                  <CompareToggle
                    slug={ship.vehicle.slug}
                    name={ship.vehicle.name}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {concepts.length === 0 ? null : (
          <section
            aria-labelledby="in-concept"
            className="flex flex-col gap-4 pt-8"
          >
            <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
              <h2 id="in-concept" className="m-0 text-heading text-primary">
                In concept
              </h2>
              <span className="text-caption text-secondary">
                RSI ship matrix figures; not in the game yet
              </span>
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
              {concepts.map((c) => {
                const poster = showcaseFor(c.slug, c.name)?.poster ?? null;
                return (
                  <li key={c.slug}>
                    <Card
                      href={`/ships/${c.slug}`}
                      name={c.name}
                      manufacturer={
                        r.manufacturers.find(
                          (m) => m.code === c.manufacturer_code,
                        )?.name ?? c.manufacturer_code
                      }
                      role={c.focus}
                      stats={[
                        { label: "Length", value: c.length_m, unit: "m" },
                        {
                          label: "Crew",
                          value:
                            c.crew_min === null || c.crew_max === null
                              ? null
                              : crewRange(c.crew_min, c.crew_max),
                        },
                      ]}
                      image={
                        poster === null
                          ? null
                          : {
                              ...poster,
                              alt: "",
                              credit: {
                                text: "Image: Roberts Space Industries",
                                href: c.page_url,
                              },
                            }
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Site>
  );
}
