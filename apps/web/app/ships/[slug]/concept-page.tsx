import type { ConceptShip } from "schema";
import {
  EntityPage,
  ScaleLineup,
  Section,
  TextLink,
  formatNumber,
  vehicleStatusBadge,
} from "ui";
import { repo } from "../../../lib/data";
import { media, shipCardImage } from "../../../lib/media";
import { showcaseFor } from "../../../lib/showcase";
import { Site } from "../../../lib/site";
import { shipCard } from "../../../lib/views";
import { crewRange } from "../../../lib/views";
import { Figures } from "./showcase/figures";
import { ShowcaseHero } from "./showcase/showcase-hero";
import { ShowcaseSections } from "./showcase/showcase-sections";

/**
 * A ship CIG has published but the game does not contain (ADR-010), the Anvil Odin first: the
 * concept hero every design is tested against. RSI's own figures and art; no stats, loadout or
 * channels, because the game has none yet, and the page says so.
 */
export function ConceptShipPage({
  concept,
}: {
  readonly concept: ConceptShip;
}) {
  const r = repo();
  const maker =
    r.manufacturers.find((m) => m.code === concept.manufacturer_code) ?? null;
  const show = showcaseFor(concept.slug, concept.name);
  const m = (v: number | null) => (v === null ? null : formatNumber(v));
  const figures = [
    { label: "Length", value: m(concept.length_m), unit: "m" },
    { label: "Beam", value: m(concept.beam_m), unit: "m" },
    { label: "Height", value: m(concept.height_m), unit: "m" },
    {
      label: "Crew",
      value:
        concept.crew_min === null || concept.crew_max === null
          ? null
          : crewRange(concept.crew_min, concept.crew_max),
    },
    { label: "Cargo", value: m(concept.cargo_scu), unit: "SCU" },
  ].flatMap((f) => (f.value === null ? [] : [{ ...f, value: f.value }]));
  const others = r.ships.filter((o) => o.stats !== null);

  return (
    <Site
      current="ships"
      theme="dark"
      stage={
        <>
          <ShowcaseHero
            name={concept.name}
            maker={
              maker === null
                ? null
                : { name: maker.name, href: `/manufacturers/${maker.slug}` }
            }
            role={concept.focus}
            status={vehicleStatusBadge("concept")}
            mark={maker === null ? null : media().maker(maker.code, maker.name)}
            background={show?.background ?? null}
            cutout={show?.cutout ?? null}
            tagline={show?.intro?.heading ?? null}
            lead={show?.intro?.text[0] ?? concept.description}
            credit={
              show?.article === null || show?.article === undefined
                ? null
                : {
                    text: "Art: Roberts Space Industries",
                    href: show.article.url,
                  }
            }
          />
          <Figures
            figures={figures}
            source="Figures as RSI's ship matrix states them. The ship is in concept: the game has no data for it yet."
          />
          {show === null ? null : (
            <ShowcaseSections
              show={show}
              name={concept.name}
              length={concept.length_m}
            />
          )}
        </>
      }
    >
      <EntityPage
        hero={null}
        facts={[]}
        related={[
          {
            title: "Ships on record",
            items: r.ships.map((s) => shipCard(s, shipCardImage(s))),
          },
        ]}
      >
        {concept.length_m === null || concept.height_m === null ? null : (
          <Section
            id="scale"
            title="To scale"
            aside={`Beside every ship on record and a person, ${formatNumber(concept.length_m)} m nose to tail`}
          >
            <ScaleLineup
              label={`${concept.name} drawn to scale beside ${others.length} ships and a person`}
              items={[
                {
                  key: concept.slug,
                  name: concept.name,
                  length: concept.length_m,
                  height: concept.height_m,
                  current: true,
                },
                ...others.flatMap((o) =>
                  o.stats === null
                    ? []
                    : [
                        {
                          key: o.vehicle.class_name,
                          name: o.vehicle.name,
                          length: o.stats.length_m,
                          height: o.stats.height_m,
                        },
                      ],
                ),
              ]}
              reference={{
                key: "person",
                name: "A person",
                length: 0.5,
                height: 1.8,
              }}
            />
          </Section>
        )}
        <Section id="matrix" title="In the ship matrix" aside="RSI">
          <figure className="m-0 flex max-w-prose flex-col gap-3">
            <blockquote className="m-0 text-heading font-regular text-primary">
              {concept.description}
            </blockquote>
            <figcaption className="text-caption text-secondary">
              <TextLink
                href={concept.page_url}
                external
                className="text-secondary"
              >
                RSI ship matrix
              </TextLink>
              , {concept.production_status.replace(/-/g, " ")}, copied{" "}
              {concept.fetched_at.slice(0, 10)}
            </figcaption>
          </figure>
        </Section>
      </EntityPage>
    </Site>
  );
}
