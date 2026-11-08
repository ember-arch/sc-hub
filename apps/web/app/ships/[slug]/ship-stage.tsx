import {
  Badge,
  type BadgeTone,
  type MakerMark,
  Mark,
  type ResponsiveImage,
  TextLink,
  formatNumber,
  sentence,
} from "ui";
import type { ShipView } from "../../../lib/data";
import { crewRange } from "../../../lib/views";
import { CompareLink, CompareToggle } from "../../compare/compare-controls";

/**
 * The ship page's stage (ADR-008): full-bleed, the first thing on the page. The ship's name set
 * large, its maker and role, CIG's own description as the opening, and four headline figures.
 * The ship's official image from RSI takes the full width above the text, credited and linked to
 * its source (ADR-009); without one there is no empty box, the type carries the stage. The image
 * is the page's largest paint, so it loads first and never lazily.
 */

export interface ShipStageProps {
  readonly ship: ShipView;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly version: string | null;
  readonly image?: ResponsiveImage | null;
  /** The maker's logo from the fankit; ship pages are dark, so its light mark shows. */
  readonly mark?: MakerMark | null;
}

export function ShipStage({
  ship,
  status,
  version,
  image,
  mark,
}: ShipStageProps) {
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
        <figure className="m-0">
          {/*
           * Inside <picture> React adds no preload hint for the image, so pages that link here
           * (and prefetch this page) do not download it; on this page the parser still finds it
           * at the top of the HTML, with high priority (ADR-009).
           */}
          <picture>
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="100vw"
              width={image.width}
              height={image.height}
              alt={image.alt}
              fetchPriority="high"
              className="block aspect-video h-auto max-h-[80svh] w-full object-cover"
            />
          </picture>
          <figcaption className="mx-auto w-full max-w-content px-4 pt-2 text-caption text-secondary">
            <TextLink
              href={image.credit.href}
              external
              className="text-secondary"
            >
              {image.credit.text}
            </TextLink>
          </figcaption>
        </figure>
      )}
      <div
        className={`mx-auto flex w-full max-w-content flex-col gap-12 px-4 pb-16 ${image === undefined || image === null ? "pt-16 md:pt-24" : "pt-12"}`}
      >
        <div className="flex flex-col gap-6">
          {mark === undefined || mark === null ? null : (
            <Mark mark={mark} heightClass="h-12" />
          )}
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
