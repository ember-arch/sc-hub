import type { ReactNode } from "react";
import {
  type BadgeTone,
  Related,
  type RelatedGroup,
  formatNumber,
  sentence,
} from "ui";
import { WIKI_CREDIT } from "ui/legal";
import type { ShipView } from "../../../../lib/data";
import { media } from "../../../../lib/media";
import { SHOWCASE_CREDITS, type ShowcaseView } from "../../../../lib/showcase";
import { crewRange } from "../../../../lib/views";
import { CompareLink, CompareToggle } from "../../../compare/compare-controls";
import {
  Capabilities,
  Dossier,
  DossierHeader,
  DossierSection,
  type SheetRow,
  type SourceEntry,
  Sources,
  type TocEntry,
} from "./dossier";
import { Exhibits } from "./exhibits";
import { ModelStage } from "./model-stage";

/**
 * A ship in the game with a showcase, as a dossier (ADR-011): the RSI Perseus is the live example.
 * The file header and CIG's own sections first, then the game data (scale, ranks, armament,
 * specifications, hardpoints) as numbered sections passed in as children, then the sources.
 */
export function LiveDossier({
  ship,
  show,
  status,
  version,
  toc,
  related,
  children,
}: {
  readonly ship: ShipView;
  readonly show: ShowcaseView;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly version: string | null;
  readonly toc: readonly TocEntry[];
  readonly related: readonly RelatedGroup[];
  readonly children: ReactNode;
}) {
  const number = (id: string): number => toc.findIndex((t) => t.id === id) + 1;
  const s = ship.stats;
  const maker = ship.manufacturer;
  const sheet: SheetRow[] = [
    {
      label: "Designation",
      value: `${maker?.name ?? ship.vehicle.manufacturer_code} ${ship.vehicle.name}`,
    },
    { label: "Role", value: ship.vehicle.role ?? "Not stated" },
    {
      label: "Size",
      value:
        ship.vehicle.size_class === null
          ? "Not stated"
          : sentence(ship.vehicle.size_class),
    },
    { label: "Status", value: status.label },
    ...(s === null
      ? []
      : ([
          ["Length", formatNumber(s.length_m, 2), "m"],
          ["Beam", formatNumber(s.beam_m, 2), "m"],
          ["Height", formatNumber(s.height_m, 2), "m"],
          ["Mass", formatNumber(s.mass_kg), "kg"],
          ["Crew", crewRange(s.crew_min, s.crew_max), undefined],
          [
            "Cargo",
            s.cargo_scu === null ? null : formatNumber(s.cargo_scu),
            "SCU",
          ],
          [
            "SCM speed",
            s.scm_speed === null ? null : formatNumber(s.scm_speed),
            "m/s",
          ],
          [
            "NAV speed",
            s.nav_speed === null ? null : formatNumber(s.nav_speed),
            "m/s",
          ],
          ["Hull", s.hull_hp === null ? null : formatNumber(s.hull_hp), "HP"],
        ] as const)
    ).flatMap(([label, value, unit]) =>
      value === null ? [] : [{ label, value, unit, numeric: true }],
    ),
  ];
  const sources: SourceEntry[] = [
    ...(show.article === null
      ? []
      : [
          {
            text: `Roberts Space Industries, Comm-Link "${show.article.title}", ${show.article.published_at.slice(0, 10)}`,
            href: show.article.url,
            note: "Key art, capability figures and the text of the summary and capabilities, quoted verbatim",
          },
        ]),
    {
      text: WIKI_CREDIT.text.replace(/\.$/, ""),
      href: WIKI_CREDIT.url,
      note: `Particulars and game data, LIVE ${version ?? ""}`,
    },
    ...(show.model === null
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

  return (
    <Dossier
      toc={toc}
      header={
        <DossierHeader
          meta={[
            {
              label: "File",
              value: `${ship.vehicle.manufacturer_code}-${ship.vehicle.slug.toUpperCase()}`,
            },
            ...(version === null
              ? []
              : [
                  {
                    label: "Build",
                    value: `LIVE ${version.split("-")[0] ?? version}`,
                  },
                ]),
            ...(show.article === null
              ? []
              : [
                  {
                    label: "Revealed",
                    value: show.article.published_at.slice(0, 10),
                  },
                ]),
            { label: "Sources", value: String(sources.length) },
          ]}
          status={status}
          mark={maker === null ? null : media().maker(maker.code, maker.name)}
          maker={
            maker === null
              ? null
              : { name: maker.name, href: `/manufacturers/${maker.slug}` }
          }
          role={ship.vehicle.role}
          name={ship.vehicle.name}
          tagline={show.intro?.heading ?? null}
          background={show.background}
          cutout={show.cutout}
          figureCredit={
            show.article === null
              ? null
              : { text: "Roberts Space Industries [1]", href: show.article.url }
          }
          sheet={sheet}
          sheetSource={`Game data, LIVE ${version ?? ""} [2]`}
          actions={
            <div className="flex flex-wrap gap-2">
              <CompareToggle
                slug={ship.vehicle.slug}
                name={ship.vehicle.name}
              />
              <CompareLink />
            </div>
          }
        />
      }
    >
      <DossierSection
        id="summary"
        number={number("summary")}
        title="Summary"
        aside="In CIG's words"
      >
        <div className="flex max-w-prose flex-col gap-4">
          {show.intro?.text.map((p) => (
            <p key={p.slice(0, 40)} className="m-0 text-body text-secondary">
              {p}
            </p>
          ))}
          {ship.description === null ? null : (
            <figure className="m-0 flex flex-col gap-2 border-l border-hairline-strong pl-4">
              <blockquote className="m-0 text-body text-primary">
                {ship.description.text}
              </blockquote>
              <figcaption className="text-caption text-secondary">
                In-game description, {ship.description.channel}{" "}
                {ship.description.game_version}
              </figcaption>
            </figure>
          )}
        </div>
      </DossierSection>
      {show.chapters.length === 0 ? null : (
        <DossierSection
          id="capabilities"
          number={number("capabilities")}
          title="Capabilities"
          aside={`${show.chapters.length} entries`}
        >
          <Capabilities
            section={number("capabilities")}
            chapters={show.chapters}
            name={ship.vehicle.name}
          />
        </DossierSection>
      )}
      {show.model === null ? null : (
        <DossierSection
          id="model"
          number={number("model")}
          title="Holoviewer model"
          aside={`${(show.model.bytes / 1_000_000).toFixed(1)} MB`}
        >
          <ModelStage
            src={show.model.src}
            bytes={show.model.bytes}
            name={ship.vehicle.name}
            length={s?.length_m ?? null}
            poster={show.poster?.src ?? null}
            credit={SHOWCASE_CREDITS.model}
            label={`Fig. ${number("model")}`}
          />
        </DossierSection>
      )}
      {show.gallery.length === 0 ? null : (
        <DossierSection
          id="exhibits"
          number={number("exhibits")}
          title="Exhibits"
          aside={`${show.gallery.length} images`}
        >
          <Exhibits section={number("exhibits")} pictures={show.gallery} />
        </DossierSection>
      )}
      {children}
      <DossierSection id="sources" number={number("sources")} title="Sources">
        <Sources sources={sources} />
      </DossierSection>
      <Related groups={related} />
    </Dossier>
  );
}
