import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Card,
  EmptyState,
  EntityPage,
  Section,
  TextLink,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { flattenPorts, repo } from "../../../lib/data";
import { Site } from "../../../lib/site";
import { shipCard, shipFacts, shipSpecRows } from "../../../lib/views";
import { StatsByChannel } from "../../components/stats-by-channel";
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

/**
 * Ship page on the EntityPage template (spec 02, "Ship page"): hero, key facts, specs by channel
 * with the PTU diff toggle, hardpoints and stock loadout, variants and paints, changed in this
 * version, in the news, related. Defaults to dark (system.md principle 3).
 */
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
  const variants = r.variantsOf(ship.vehicle.class_name);
  const base =
    ship.vehicle.base_variant_of === null
      ? null
      : (variants.find(
          (v) => v.vehicle.class_name === ship.vehicle.base_variant_of,
        ) ?? null);
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
          aside={
            version === null
              ? "No LIVE build"
              : r.ptuVersion === null
                ? `LIVE ${version}`
                : `LIVE ${version} · PTU ${r.ptuVersion}`
          }
        >
          {s === null ? (
            <EmptyState>
              No LIVE stats for this ship in the current data pack.
            </EmptyState>
          ) : (
            <StatsByChannel
              rows={shipSpecRows(ship)}
              ptuVersion={r.ptuVersion}
              hasPtuRow={ship.ptu !== null}
            />
          )}
        </Section>
        <Section
          id="hardpoints"
          title="Hardpoints and stock loadout"
          aside={
            version === null
              ? `${ports.length} of ${allPorts.length} ports`
              : `${ports.length} of ${allPorts.length} ports · LIVE ${version}`
          }
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
        <Section
          id="variants"
          title="Variants and paints"
          aside={
            variants.length + ship.paints.length === 0
              ? undefined
              : `${variants.length} variants · ${ship.paints.length} paints`
          }
        >
          {variants.length === 0 && ship.paints.length === 0 ? (
            <EmptyState>
              No variants or paints in the current data pack.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-6">
              {variants.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h3 className="text-ui font-medium text-primary">
                    {base === null
                      ? "Variants"
                      : `Variant of the ${base.vehicle.name}`}
                  </h3>
                  <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
                    {variants.map((v) => (
                      <li key={v.vehicle.class_name}>
                        <Card {...shipCard(v)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ship.paints.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h3 className="text-ui font-medium text-primary">Paints</h3>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-ui">
                    {ship.paints.map((paint) => (
                      <li
                        key={paint.id}
                        className="rounded-control border border-hairline bg-surface px-3 py-1 text-primary"
                      >
                        {paint.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Section>
        <Section
          id="changes"
          title="Changed in this version"
          aside={version === null ? undefined : `LIVE ${version}`}
        >
          <EmptyState>
            No earlier LIVE version in the current data pack to compare against;
            changes appear here once the pipeline publishes a second version.
          </EmptyState>
        </Section>
        <Section id="news" title="In the news">
          <EmptyState>
            No news mentions this ship yet; see the{" "}
            <TextLink href="/news">news feed</TextLink>.
          </EmptyState>
        </Section>
      </EntityPage>
    </Site>
  );
}
