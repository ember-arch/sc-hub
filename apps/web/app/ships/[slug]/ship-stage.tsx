import { Badge, type BadgeTone, TextLink, formatNumber, sentence } from "ui";
import type { ShipView } from "../../../lib/data";
import { crewRange } from "../../../lib/views";
import { CompareLink, CompareToggle } from "../../compare/compare-controls";

/**
 * The ship page's stage (ADR-008): full-bleed, the first thing on the page. The ship's name set
 * large, its maker and role, CIG's own description as the opening, and four headline figures.
 * A render (fankit or pipeline thumbnail) takes the full width above the text once one exists;
 * without one there is no empty box, the type carries the stage.
 */

export interface ShipStageProps {
  readonly ship: ShipView;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly version: string | null;
  readonly image?: { readonly src: string; readonly alt: string } | null;
}

export function ShipStage({ ship, status, version, image }: ShipStageProps) {
  const s = ship.stats;
  const maker = ship.manufacturer;
  const figures: { label: string; value: string; unit?: string }[] =
    s === null
      ? []
      : [
          { label: "Length", value: formatNumber(s.length_m, 2), unit: "m" },
          { label: "Crew", value: crewRange(s.crew_min, s.crew_max) },
          ...(s.cargo_scu === null
            ? []
            : [
                {
                  label: "Cargo",
                  value: formatNumber(s.cargo_scu),
                  unit: "SCU",
                },
              ]),
          ...(s.scm_speed === null
            ? []
            : [
                {
                  label: "SCM speed",
                  value: formatNumber(s.scm_speed),
                  unit: "m/s",
                },
              ]),
        ];
  return (
    <section aria-labelledby="ship-name" className="border-b border-hairline">
      {image === undefined || image === null ? null : (
        <img
          src={image.src}
          alt={image.alt}
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="mx-auto flex w-full max-w-content flex-col gap-12 px-4 pb-16 pt-16 md:pt-24">
        <div className="flex flex-col gap-6">
          <p className="m-0 text-ui text-secondary">
            {maker === null ? (
              ship.vehicle.manufacturer_code
            ) : (
              <TextLink href={`/manufacturers/${maker.slug}`}>
                {maker.name}
              </TextLink>
            )}
            {ship.vehicle.role === null ? null : <> · {ship.vehicle.role}</>}
          </p>
          <h1
            id="ship-name"
            className="m-0 text-display text-primary md:text-hero"
          >
            {ship.vehicle.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={status.tone}>{status.label}</Badge>
            {ship.vehicle.size_class === null ? null : (
              <span className="text-ui text-secondary">
                {sentence(ship.vehicle.size_class)}{" "}
                {ship.vehicle.kind === "ship" ? "ship" : "vehicle"}
              </span>
            )}
          </div>
          {ship.description === null ? null : (
            <figure className="m-0 flex max-w-prose flex-col gap-3">
              <blockquote className="m-0 text-heading font-regular text-primary">
                {ship.description.text}
              </blockquote>
              <figcaption className="text-caption text-secondary">
                {ship.description.source === "localization"
                  ? "In-game description"
                  : "Ship matrix description"}
                , {ship.description.channel} {ship.description.game_version}
              </figcaption>
            </figure>
          )}
          <div className="flex flex-wrap gap-2">
            <CompareToggle slug={ship.vehicle.slug} name={ship.vehicle.name} />
            <CompareLink />
          </div>
        </div>
        {figures.length === 0 ? null : (
          <div className="flex flex-col gap-3">
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-hairline pt-8 md:grid-cols-4">
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col gap-1">
                  <dt className="text-caption text-secondary">{f.label}</dt>
                  <dd className="m-0 text-primary">
                    <span className="font-mono text-display">{f.value}</span>
                    {f.unit === undefined ? null : (
                      <span className="text-ui text-secondary"> {f.unit}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {version === null ? null : (
              <p className="m-0 text-caption text-secondary">LIVE {version}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
