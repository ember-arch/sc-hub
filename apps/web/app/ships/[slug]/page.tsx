import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repo } from "../../../lib/data";
import { entityForSlug } from "../../../lib/entity-route";
import { shipJsonLd } from "../../../lib/seo";
import { conceptBySlug, conceptShips } from "../../../lib/showcase";
import { Site } from "../../../lib/site";
import { JsonLdScript } from "../../json-ld";
import { conceptShipFile, packShipFile } from "./file-builders";
import { ShipFile, ShipFileOpening } from "./ship-file";

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return [
    ...repo().ships.map((s) => ({ slug: s.vehicle.slug })),
    ...conceptShips().map((c) => ({ slug: c.slug })),
  ];
}

/**
 * The ship for a slug. An old slug from slug_history answers with a permanent redirect to the
 * current one (spec 02, "Slugs and redirects"; Next sends 308, the permanent status that also
 * keeps the method); an unknown slug is a 404 with the search box.
 */
function shipFor(slug: string) {
  const r = repo();
  const vehicle = entityForSlug(
    r.ships.map((s) => s.vehicle),
    slug,
    "/ships",
  );
  const ship = r.shipBySlug(vehicle.slug);
  if (ship === undefined) notFound();
  return ship;
}

function describe(ship: ReturnType<typeof shipFor>): string {
  const maker = ship.manufacturer?.name ?? ship.vehicle.manufacturer_code;
  return `${maker} ${ship.vehicle.name}: ship file with crew, combat, mobility, specifications, hardpoints and stock loadout by game version.`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const concept = conceptBySlug(slug);
  if (concept !== undefined) {
    return {
      title: concept.name,
      description: `${concept.name}: ship file with CIG's published figures, stated capabilities, pledge price, imagery and holoviewer model. In concept.`,
      alternates: { canonical: `/ships/${concept.slug}` },
    };
  }
  const ship = shipFor(slug);
  return {
    title: ship.vehicle.name,
    description: describe(ship),
    alternates: { canonical: `/ships/${ship.vehicle.slug}` },
  };
}

/**
 * Every ship page is a ship file (ADR-012): the same two columns and the same ten numbered sections
 * for a concept ship and a flying one, written for acquisition, profession and battle planning.
 * Follows the reader's scheme (ADR-021).
 */
export default async function ShipPage({ params }: Params) {
  const { slug } = await params;
  const concept = conceptBySlug(slug);
  if (concept !== undefined) {
    const file = conceptShipFile(concept);
    return (
      <Site current="ships" stage={<ShipFileOpening {...file} />}>
        <ShipFile {...file} />
      </Site>
    );
  }
  const ship = shipFor(slug);
  const file = packShipFile(ship);
  return (
    <Site current="ships" stage={<ShipFileOpening {...file} />}>
      <JsonLdScript data={shipJsonLd(ship, describe(ship))} />
      <ShipFile {...file} />
    </Site>
  );
}
