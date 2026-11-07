import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EmptyState,
  EntityPage,
  Section,
  StatList,
  StatRow,
  TextLink,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { flattenPorts, repo } from "../../../lib/data";
import { Site } from "../../../lib/site";
import { crewRange, shipCard, shipFacts } from "../../../lib/views";
import { PortTable } from "./port-table";

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return repo().ships.map((s) => ({ slug: s.vehicle.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const ship = repo().shipBySlug(slug);
  if (ship === undefined) return { title: "Ship not found" };
  const maker = ship.manufacturer?.name ?? ship.vehicle.manufacturer_code;
  return {
    title: ship.vehicle.name,
    description: `${maker} ${ship.vehicle.name}: specifications, hardpoints and stock loadout by game version.`,
  };
}

/** Ship page on the EntityPage template; defaults to dark (system.md principle 3). */
export default async function ShipPage({ params }: Params) {
  const { slug } = await params;
  const r = repo();
  const ship = r.shipBySlug(slug);
  if (ship === undefined) notFound();
  const status = vehicleStatusBadge(ship.vehicle.status);
  const s = ship.stats;
  const allPorts = flattenPorts(r.shipPorts(ship.vehicle.class_name));
  // Ports the wiki types as `other` with nothing mounted are structural; the pack keeps them.
  const ports = allPorts.filter(
    ({ node }) => node.port.port_type !== "other" || node.item !== null,
  );
  const hiddenPorts = allPorts.length - ports.length;
  const version = s?.game_version ?? r.liveVersion ?? null;
  const related = [
    {
      title: `More from ${ship.manufacturer?.name ?? ship.vehicle.manufacturer_code}`,
      items: r
        .lineup(ship.vehicle.manufacturer_code)
        .filter((o) => o.vehicle.class_name !== ship.vehicle.class_name)
        .map(shipCard),
    },
    {
      title:
        ship.vehicle.role === null
          ? "Same role"
          : `Other ${ship.vehicle.role.toLowerCase()} ships`,
      items: r.ships
        .filter(
          (o) =>
            o.vehicle.class_name !== ship.vehicle.class_name &&
            o.vehicle.role !== null &&
            o.vehicle.role === ship.vehicle.role,
        )
        .map(shipCard),
    },
  ];

  return (
    <Site current="ships" theme="dark">
      <EntityPage
        hero={{
          name: ship.vehicle.name,
          kicker:
            ship.manufacturer === null
              ? { label: ship.vehicle.manufacturer_code }
              : {
                  label: ship.manufacturer.name,
                  href: `/manufacturers/${ship.manufacturer.slug}`,
                },
          status,
          image: null,
          placeholder:
            "Render placeholder until the fankit image or the 3D viewer lands",
        }}
        facts={shipFacts(ship, status.label)}
        related={related}
      >
        <Section
          id="specs"
          title="Specifications"
          aside={version === null ? "No LIVE build" : `LIVE ${version}`}
        >
          {s === null ? (
            <EmptyState>
              No LIVE stats for this ship in the current data pack.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
              <StatList>
                <StatRow
                  label="Length"
                  value={s.length_m}
                  unit="m"
                  digits={2}
                />
                <StatRow label="Beam" value={s.beam_m} unit="m" digits={2} />
                <StatRow
                  label="Height"
                  value={s.height_m}
                  unit="m"
                  digits={2}
                />
                <StatRow label="Mass" value={s.mass_kg} unit="kg" />
                <StatRow label="Cargo" value={s.cargo_scu} unit="SCU" />
                <StatRow
                  label="Crew"
                  value={crewRange(s.crew_min, s.crew_max)}
                />
              </StatList>
              <StatList>
                <StatRow label="Hull" value={s.hull_hp} unit="HP" />
                <StatRow label="SCM speed" value={s.scm_speed} unit="m/s" />
                <StatRow label="NAV speed" value={s.nav_speed} unit="m/s" />
                <StatRow
                  label="Hydrogen capacity"
                  value={s.hydrogen_capacity}
                />
                <StatRow label="Quantum capacity" value={s.quantum_capacity} />
                <StatRow
                  label="Size class"
                  value={
                    ship.vehicle.size_class === null
                      ? null
                      : sentence(ship.vehicle.size_class)
                  }
                />
              </StatList>
            </div>
          )}
        </Section>
        <Section id="ptu" title="PTU differences" aside="LIVE is canonical">
          <EmptyState>
            No PTU build recorded. PTU values show as differences against LIVE
            once a PTU pack is imported.
          </EmptyState>
        </Section>
        <Section
          id="hardpoints"
          title="Hardpoints and stock loadout"
          aside={`${ports.length} of ${allPorts.length} ports`}
        >
          {ports.length === 0 ? (
            <EmptyState>
              No hardpoints in the current data pack for this ship.
            </EmptyState>
          ) : (
            <PortTable
              rows={ports.map(({ node, depth }) => ({
                key: node.port.port_path,
                depth,
                name: node.port.port_name,
                type: sentence(node.port.port_type),
                sizeMin: node.port.size_min,
                sizeMax: node.port.size_max,
                item:
                  node.item === null
                    ? null
                    : {
                        name: node.item.name,
                        href: `/components/${node.item.slug}`,
                      },
                position: node.port.position,
              }))}
            />
          )}
          {hiddenPorts > 0 ? (
            <p className="text-caption text-secondary">
              {hiddenPorts} ports of unmapped type with nothing mounted are not
              listed.
            </p>
          ) : null}
        </Section>
        <Section id="variants" title="Variants and paints">
          <EmptyState>
            No variants or paints in the current data pack. They arrive with the
            real extraction in spec 01.
          </EmptyState>
        </Section>
        <Section id="news" title="In the news">
          <EmptyState>
            No news mentions this ship yet. Entity linking arrives with spec 03;
            see the <TextLink href="/news">news feed</TextLink>.
          </EmptyState>
        </Section>
      </EntityPage>
    </Site>
  );
}
