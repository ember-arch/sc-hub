import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, EmptyState, EntityPage, Section } from "ui";
import { repo } from "../../../lib/data";
import { Site } from "../../../lib/site";
import { shipCard } from "../../../lib/views";
import { ComponentTable } from "../../components/component-table";
import { componentRows } from "../../components/page";

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return repo().manufacturers.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const m = repo().manufacturerBySlug(slug);
  if (m === undefined) return { title: "Manufacturer not found" };
  return { title: m.name, description: `${m.name}: ships and components.` };
}

/** Manufacturer page: EntityPage with the 3 px brand rule, lineup cards, description only from fankit or localization. */
export default async function ManufacturerPage({ params }: Params) {
  const { slug } = await params;
  const r = repo();
  const m = r.manufacturerBySlug(slug);
  if (m === undefined) notFound();
  const lineup = r.lineup(m.code);
  const components = r.componentsBy(m.code);
  return (
    <Site>
      <EntityPage
        hero={{
          name: m.name,
          kicker: { label: "Manufacturer" },
          brandRule: true,
        }}
        facts={[
          { label: "Code", value: m.code },
          { label: "Ships", value: lineup.length },
          { label: "Components", value: components.length },
          {
            label: "Description",
            value: m.description === "" ? null : m.description,
          },
        ]}
      >
        <Section
          id="lineup"
          title="Lineup"
          aside={`${lineup.length} ships in the current data pack`}
        >
          {lineup.length === 0 ? (
            <EmptyState>
              No ships from this manufacturer in the current data pack.
            </EmptyState>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {lineup.map((ship) => (
                <li key={ship.vehicle.class_name}>
                  <Card {...shipCard(ship)} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          id="components"
          title="Components"
          aside={`${components.length}`}
        >
          {components.length === 0 ? (
            <EmptyState>
              No components from this manufacturer in the current data pack.
            </EmptyState>
          ) : (
            <ComponentTable
              caption={`Components by ${m.name}`}
              rows={componentRows(components)}
            />
          )}
        </Section>
        <Section id="news" title="In the news">
          <EmptyState>
            No news mentions this manufacturer yet. Entity linking arrives with
            spec 03.
          </EmptyState>
        </Section>
      </EntityPage>
    </Site>
  );
}
