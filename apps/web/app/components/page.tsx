import type { Metadata } from "next";
import { Masthead } from "../masthead";
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
          title="Components"
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
            // Each type as a tile with its count (ADR-019): the page's map, and a jump to its table.
            <nav aria-label="Component types">
              <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {groups.map((g) => (
                  <li key={g.type}>
                    <a
                      href={`#${g.type}`}
                      className="group flex h-full flex-col gap-2 rounded-card border border-hairline bg-surface p-3 no-underline transition-colors duration-hover hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span className="font-mono text-heading text-primary group-hover:text-accent">
                        {g.items.length}
                      </span>
                      <span className="text-caption text-secondary">
                        {sentence(g.type)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
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
