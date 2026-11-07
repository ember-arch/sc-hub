import type { Metadata } from "next";
import { Card } from "ui";
import { repo } from "../../lib/data";
import { Site } from "../../lib/site";
import { shipCard } from "../../lib/views";

export const metadata: Metadata = { title: "Ships" };

/** Ships index. Filters, URL state and the table view arrive with spec 02. */
export default function ShipsPage() {
  const r = repo();
  return (
    <Site current="ships">
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-title text-primary">Ships</h1>
          <p className="text-caption text-muted">
            {r.ships.length} ships · {r.liveVersion ?? "no LIVE build"}
          </p>
        </div>
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {r.ships.map((ship) => (
            <li key={ship.vehicle.class_name}>
              <Card {...shipCard(ship)} />
            </li>
          ))}
        </ul>
      </div>
    </Site>
  );
}
