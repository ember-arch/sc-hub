import type { ReactNode } from "react";
import type { ConceptShip } from "schema";
import { ScaleLineup, formatNumber, sentence, vehicleStatusBadge } from "ui";
import { repo } from "../../../lib/data";
import { media } from "../../../lib/media";
import { SHOWCASE_CREDITS, showcaseFor } from "../../../lib/showcase";
import { Site } from "../../../lib/site";
import { crewRange } from "../../../lib/views";
import {
  Capabilities,
  Dossier,
  DossierHeader,
  DossierSection,
  Figure,
  type SheetRow,
  type SourceEntry,
  Sources,
  type TocEntry,
} from "./showcase/dossier";
import { Exhibits, Schematics } from "./showcase/exhibits";
import { ModelStage } from "./showcase/model-stage";

/**
 * A ship CIG has published but the game does not contain (ADR-010), as a dossier (ADR-011): the
 * Anvil Odin first, the concept hero every design is tested against. RSI's own figures, art and
 * words; no stats, loadout or channels, because the game has none yet, and the file says so.
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
  const n = (v: number | null): string | null =>
    v === null ? null : formatNumber(v);
  const sheet: SheetRow[] = [
    {
      label: "Designation",
      value: `${maker?.name ?? concept.manufacturer_code} ${concept.name}`,
    },
    { label: "Class", value: concept.focus ?? "Not stated" },
    {
      label: "Size",
      value: concept.size === null ? "Not stated" : sentence(concept.size),
    },
    { label: "Status", value: "Concept" },
    ...(
      [
        ["Length", n(concept.length_m), "m"],
        ["Beam", n(concept.beam_m), "m"],
        ["Height", n(concept.height_m), "m"],
        [
          "Crew",
          concept.crew_min === null || concept.crew_max === null
            ? null
            : crewRange(concept.crew_min, concept.crew_max),
          undefined,
        ],
        ["Cargo", n(concept.cargo_scu), "SCU"],
      ] as const
    ).flatMap(([label, value, unit]) =>
      value === null ? [] : [{ label, value, unit, numeric: true }],
    ),
  ];
  const sources: SourceEntry[] = [
    ...(show?.article == null
      ? []
      : [
          {
            text: `Roberts Space Industries, Comm-Link "${show.article.title}", ${show.article.published_at.slice(0, 10)}`,
            href: show.article.url,
            note: "Key art, render loops, the capability figures and the text of the summary and capabilities, quoted verbatim",
          },
        ]),
    {
      text: `RSI ship matrix, ${concept.name}`,
      href: concept.page_url,
      note: `Particulars, copied ${concept.fetched_at.slice(0, 10)}`,
    },
    ...(show?.model == null
      ? []
      : [
          {
            text: SHOWCASE_CREDITS.model.text,
            href: SHOWCASE_CREDITS.model.href,
          },
        ]),
    {
      text: "CIG fankit, manufacturer logo",
      href: "https://robertsspaceindustries.com/fankit",
    },
  ];
  const others = r.ships.filter((o) => o.stats !== null);
  const model = show?.model ?? null;
  const length = concept.length_m;
  const height = concept.height_m;

  const sections: {
    id: string;
    title: string;
    aside?: string;
    /** Built with the section's own number, so figure numbers always match. */
    body: (n: number) => ReactNode;
  }[] = [
    {
      id: "summary",
      title: "Summary",
      aside: "In CIG's words",
      body: (n: number) => (
        <div className="grid gap-8 md:grid-cols-9">
          <div className="flex flex-col gap-4 md:col-span-6">
            {show?.intro?.heading === undefined ? null : (
              <p className="m-0 text-heading text-primary">
                {show.intro.heading}
              </p>
            )}
            {(show?.intro?.text ?? [concept.description]).map((p) => (
              <p key={p.slice(0, 40)} className="m-0 text-body text-secondary">
                {p}
              </p>
            ))}
          </div>
          {show?.topdown == null ? null : (
            <Figure
              label={`Fig. ${n}`}
              caption="Plan view"
              picture={show.topdown}
              sizes="(min-width: 768px) 25vw, 60vw"
              className="md:col-span-3 [&_img]:mx-auto [&_img]:max-h-[560px] [&_img]:w-auto"
            />
          )}
        </div>
      ),
    },
    ...(show === null || show.chapters.length === 0
      ? []
      : [
          {
            id: "capabilities",
            title: "Capabilities",
            aside: `${show.chapters.length} entries`,
            body: (n: number) => (
              <Capabilities
                section={n}
                chapters={show.chapters}
                name={concept.name}
              />
            ),
          },
        ]),
    ...(model === null
      ? []
      : [
          {
            id: "model",
            title: "Holoviewer model",
            aside: `${(model.bytes / 1_000_000).toFixed(1)} MB`,
            body: (n: number) => (
              <ModelStage
                src={model.src}
                bytes={model.bytes}
                name={concept.name}
                length={concept.length_m}
                poster={show?.poster?.src ?? null}
                credit={SHOWCASE_CREDITS.model}
                label={`Fig. ${n}`}
              />
            ),
          },
        ]),
    ...(show === null || show.schematics.length === 0
      ? []
      : [
          {
            id: "schematics",
            title: "Schematics",
            body: (n: number) => (
              <Schematics section={n} schematics={show.schematics} />
            ),
          },
        ]),
    ...(length === null || height === null
      ? []
      : [
          {
            id: "scale",
            title: "To scale",
            aside: `Beside every ship on record and a person`,
            body: () => (
              <ScaleLineup
                label={`${concept.name} drawn to scale beside ${others.length} ships and a person`}
                items={[
                  {
                    key: concept.slug,
                    name: concept.name,
                    length,
                    height,
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
            ),
          },
        ]),
    ...(show === null || show.gallery.length === 0
      ? []
      : [
          {
            id: "exhibits",
            title: "Exhibits",
            aside: `${show.gallery.length} images`,
            body: (n: number) => (
              <Exhibits section={n} pictures={show.gallery} />
            ),
          },
        ]),
    {
      id: "sources",
      title: "Sources",
      body: () => <Sources sources={sources} />,
    },
  ];
  const toc: TocEntry[] = sections.map((s) => ({ id: s.id, title: s.title }));

  return (
    <Site current="ships" theme="dark">
      <Dossier
        toc={toc}
        header={
          <DossierHeader
            meta={[
              {
                label: "File",
                value: `${concept.manufacturer_code}-${concept.slug.toUpperCase()}`,
              },
              ...(show?.article == null
                ? []
                : [
                    {
                      label: "Revealed",
                      value: show.article.published_at.slice(0, 10),
                    },
                  ]),
              { label: "Compiled", value: concept.fetched_at.slice(0, 10) },
              { label: "Sources", value: String(sources.length) },
            ]}
            status={vehicleStatusBadge("concept")}
            mark={maker === null ? null : media().maker(maker.code, maker.name)}
            maker={
              maker === null
                ? null
                : { name: maker.name, href: `/manufacturers/${maker.slug}` }
            }
            role={concept.focus}
            name={concept.name}
            tagline={show?.intro?.heading ?? null}
            background={show?.background ?? null}
            cutout={show?.cutout ?? null}
            figureCredit={
              show?.article == null
                ? null
                : {
                    text: "Roberts Space Industries [1]",
                    href: show.article.url,
                  }
            }
            sheet={sheet}
            sheetSource="RSI ship matrix [2]. In concept: the game has no data for this ship yet."
          />
        }
      >
        {sections.map((s, i) => (
          <DossierSection
            key={s.id}
            id={s.id}
            number={i + 1}
            title={s.title}
            aside={s.aside}
          >
            {s.body(i + 1)}
          </DossierSection>
        ))}
      </Dossier>
    </Site>
  );
}
