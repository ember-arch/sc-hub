import type { Metadata } from "next";
import { Masthead } from "../masthead";
import { FigureStrip } from "../strip";
import { ItemType } from "schema";
import {
  EmptyState,
  FilterBar,
  FilterSelect,
  Section,
  TextLink,
  sentence,
} from "ui";
import {
  applyComponentFilters,
  componentFacetOptions,
  componentIndexHref,
  hasComponentFilters,
  parseComponentQuery,
} from "../../lib/component-filters";
import { repo } from "../../lib/data";
import type { Query } from "../../lib/ship-filters";
import { Site } from "../../lib/site";
import { componentRows } from "../../lib/views";
import { ComponentTable } from "./component-table";

export const metadata: Metadata = {
  title: "Components",
  alternates: { canonical: "/components" },
  description:
    "Star Citizen ship components grouped by type: weapons, shields, power plants, coolers, quantum drives and more, with size and manufacturer filters.",
};

/** Components grouped by type with size and manufacturer filters as URL state (spec 02). */
export default async function ComponentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  const r = repo();
  const filters = parseComponentQuery(await searchParams);
  const components = applyComponentFilters(r.components, filters);
  const options = componentFacetOptions(r.components);
  const filtered = hasComponentFilters(filters);
  const groups = ItemType.options
    .map((type) => ({
      type,
      items: components.filter((c) => c.item.type === type),
    }))
    .filter((g) => g.items.length > 0);
  const clearHref = componentIndexHref({});
  return (
    <Site
      current="components"
      stage={
        <Masthead
          eyebrow={[
            <span key="count" data-testid="component-count">
              {filtered
                ? `${components.length} of ${r.components.length} components`
                : `${r.components.length} components in ${groups.length} types`}
            </span>,
            r.liveVersion ?? "no LIVE build",
          ]}
          title="Parts, by type"
          lede="Every weapon, shield, power plant, cooler, quantum drive and the rest, with its stats by build and the ships that carry it as stock."
        />
      }
    >
      <div className="flex flex-col gap-12 pt-8">
        <div className="flex flex-col gap-8">
          <FilterBar
            action="/components"
            label="Filter components"
            clearHref={filtered ? clearHref : undefined}
          >
            <FilterSelect
              name="size"
              label="Size"
              allLabel="All sizes"
              value={filters.size ?? ""}
              options={options.size}
            />
            <FilterSelect
              name="manufacturer"
              label="Manufacturer"
              allLabel="All manufacturers"
              value={filters.manufacturer ?? ""}
              options={options.manufacturer}
            />
          </FilterBar>
          {groups.length > 1 ? (
            // Each type as a figure with its count (ADR-019, as the almanac's strip per ADR-020): the page's map, and a jump to its table.
            <nav aria-label="Component types">
              <FigureStrip
                columns={6}
                figures={groups.map((g) => ({
                  label: sentence(g.type),
                  value: String(g.items.length),
                  href: `#${g.type}`,
                }))}
              />
            </nav>
          ) : null}
        </div>
        {groups.length === 0 ? (
          <EmptyState>
            No components match these filters.{" "}
            <TextLink href={clearHref}>Clear filters</TextLink> to see every
            component.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <Section
              key={g.type}
              id={g.type}
              title={sentence(g.type)}
              aside={`${g.items.length}`}
            >
              <ComponentTable
                caption={sentence(g.type)}
                rows={componentRows(g.items)}
              />
            </Section>
          ))
        )}
      </div>
    </Site>
  );
}
