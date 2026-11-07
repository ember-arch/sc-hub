import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Card,
  EmptyState,
  EntityPage,
  Section,
  StatsByChannel,
  sentence,
} from "ui";
import { repo } from "../../../lib/data";
import { Site } from "../../../lib/site";
import {
  componentFacts,
  componentStatRows,
  shipCard,
} from "../../../lib/views";

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return repo().components.map((c) => ({ slug: c.item.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const c = repo().componentBySlug(slug);
  if (c === undefined) return { title: "Component not found" };
  return {
    title: c.item.name,
    description: `${c.item.name}: a size ${c.item.size} ${sentence(c.item.type).toLowerCase()} by ${c.manufacturer?.name ?? c.item.manufacturer_code}, stats by game version and the ships that carry it.`,
  };
}

/**
 * Component page on the EntityPage template (spec 02, "Component index and pages"): key facts,
 * stats by channel with the PTU diff toggle, stock on (the ships that carry it by default), news.
 */
export default async function ComponentPage({ params }: Params) {
  const { slug } = await params;
  const r = repo();
  const c = r.componentBySlug(slug);
  if (c === undefined) notFound();
  const stats = c.stats;
  const rows = componentStatRows(c);
  const stockOn = r.stockOn(c.item.class_name);
  return (
    <Site current="components">
      <EntityPage
        hero={{
          name: c.item.name,
          kicker:
            c.manufacturer === null
              ? { label: c.item.manufacturer_code }
              : {
                  label: c.manufacturer.name,
                  href: `/manufacturers/${c.manufacturer.slug}`,
                },
        }}
        facts={componentFacts(c)}
      >
        <Section
          id="stats"
          title="Stats"
          aside={
            stats === null
              ? "No LIVE build"
              : r.ptuVersion === null
                ? `LIVE ${stats.game_version}`
                : `LIVE ${stats.game_version} · PTU ${r.ptuVersion}`
          }
        >
          {rows.length === 0 ? (
            <EmptyState>
              No stats for this component in the current data pack.
            </EmptyState>
          ) : (
            <StatsByChannel
              rows={rows}
              ptuVersion={r.ptuVersion}
              hasPtuRow={c.ptu !== null}
            />
          )}
        </Section>
        <Section
          id="stock"
          title="Stock on"
          aside={
            stockOn.length === 0
              ? undefined
              : `${stockOn.length} ${stockOn.length === 1 ? "ship" : "ships"}`
          }
        >
          {stockOn.length === 0 ? (
            <EmptyState>
              No ship in the current data pack carries this component by
              default.
            </EmptyState>
          ) : (
            <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
              {stockOn.map((ship) => (
                <li key={ship.vehicle.class_name}>
                  <Card {...shipCard(ship)} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section id="news" title="In the news">
          <EmptyState>No news mentions this component yet.</EmptyState>
        </Section>
      </EntityPage>
    </Site>
  );
}
