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
  formatNumber,
  sentence,
} from "ui";
import {
  applyComponentFilters,
  componentFacetOptions,
  componentIndexHref,
  hasComponentFilters,
  parseComponentQuery,
  FIXED_TYPES,
  parseFixedShown,
  withoutFixed,
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
  const query = await searchParams;
  const filters = parseComponentQuery(query);
  // Thrusters and fuel intakes come with the ship; they are listed on request (ADR-046).
  const fixedShown = parseFixedShown(query);
  const listed = withoutFixed(r.components, fixedShown);
  // The built-in parts under the current filters: what "Show them" would add.
  const fixedCount = applyComponentFilters(
    r.components.filter((c) => FIXED_TYPES.has(c.item.type)),
    filters,
  ).length;
  const components = applyComponentFilters(listed, filters);
  const options = componentFacetOptions(listed);
  const filtered = hasComponentFilters(filters);
  const groups = ItemType.options
    .map((type) => ({
      type,
      items: components.filter((c) => c.item.type === type),
    }))
    .filter((g) => g.items.length > 0);
  const clearHref = componentIndexHref({}, fixedShown);
  const fixedHref = componentIndexHref(filters, !fixedShown);
  return (
    <Site
      current="components"
      stage={
        <Masthead
          eyebrow={[
            <span key="count" data-testid="component-count">
              {filtered
                ? `${components.length} of ${listed.length} components`
                : `${listed.length} components in ${groups.length} types`}
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
            hidden={fixedShown ? { fixed: "shown" } : undefined}
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
          {fixedCount === 0 ? null : (
            <p
              className="m-0 max-w-prose text-ui text-secondary"
              data-testid="fixed-parts"
            >
              {fixedShown
                ? `Thrusters and fuel intakes are listed: ${formatNumber(fixedCount)} parts that come with the ship and are not swapped. `
                : `Thrusters and fuel intakes are left out: ${formatNumber(fixedCount)} parts that come with the ship and are not swapped. `}
              <TextLink href={fixedHref}>
                {fixedShown ? "Hide them" : "Show them"}
              </TextLink>
            </p>
          )}
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
