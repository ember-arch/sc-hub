import type { ConceptShip } from "schema";
import {
  RankBar,
  ScaleLineup,
  StatsByChannel,
  TextLink,
  formatNumber,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { WIKI_CREDIT } from "ui/legal";
import { armament } from "../../../lib/armament";
import { type ShipView, flattenPorts, repo } from "../../../lib/data";
import { loadoutGroups } from "../../../lib/loadout";
import { media } from "../../../lib/media";
import {
  type Fact,
  type ShipClaim,
  claimsFor,
  equipment,
  listEquipment,
  portCount,
  rankAmong,
  rankWord,
} from "../../../lib/ship-file";
import {
  type Picture,
  SHOWCASE_CREDITS,
  type ShowcaseView,
  sentenceCase,
  showcaseFor,
} from "../../../lib/showcase";
import { crewRange, shipSpecRows } from "../../../lib/views";
import { ArmamentStrip } from "./armament-strip";
import { LoadoutPanels } from "./loadout-panels";
import { PortTable } from "./port-table";
import { type SourceEntry, Sources } from "./showcase/dossier";
import {
  Claims,
  Facts,
  Gap,
  MediaWall,
  type ShipFileProps,
  SHIP_FILE_SECTIONS,
} from "./ship-file";

/**
 * Builds a ship file (ADR-012) for a ship in the pack or a concept ship. Both produce the same ten
 * sections in the same order; the wording is composed from the data, never copied from RSI's sales
 * text. Where data is missing the section says so, and CIG's stated claims are listed and cited.
 */

const section = (id: (typeof SHIP_FILE_SECTIONS)[number]["id"]): number =>
  SHIP_FILE_SECTIONS.findIndex((s) => s.id === id) + 1;

const fileNumber = (code: string, slug: string): string =>
  `${code}-${slug.toUpperCase()}`;

const n0 = (v: number): string => formatNumber(v);

/** Sources in a fixed order; claims and captions cite them by number. */
function sourceList(
  show: ShowcaseView | null,
  extra: readonly SourceEntry[],
): SourceEntry[] {
  return [
    ...(show?.article == null
      ? []
      : [
          {
            text: `Roberts Space Industries, Comm-Link "${show.article.title}", ${show.article.published_at.slice(0, 10)}`,
            href: show.article.url,
            note: "Key art, render loops, images and CIG's stated claims",
          },
        ]),
    ...extra,
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
}

/** Every image and render loop of a showcase, captioned with CIG's short labels, deduplicated. */
function mediaOf(
  show: ShowcaseView | null,
  fallback: { picture: Picture; caption: string } | null,
) {
  if (show === null)
    return { videos: [], images: fallback === null ? [] : [fallback] };
  const videos = show.chapters.flatMap((c) =>
    c.video === null
      ? []
      : [
          {
            src: c.video.src,
            poster: c.video.poster ?? c.image?.src ?? null,
            caption: `${sentenceCase(c.kicker ?? c.heading)}, render loop`,
          },
        ],
  );
  const seen = new Set<string>();
  const images: { picture: Picture; caption: string }[] = [];
  const add = (picture: Picture | null, caption: string) => {
    if (picture === null || seen.has(picture.src)) return;
    seen.add(picture.src);
    images.push({ picture, caption });
  };
  add(show.background, "Key art");
  for (const c of show.chapters)
    add(c.image, sentenceCase(c.kicker ?? c.heading));
  add(show.topdown, "Plan view");
  for (const s of show.schematics) add(s.wide, s.caption);
  for (const g of show.gallery) add(g, "Exhibit");
  if (fallback !== null) add(fallback.picture, fallback.caption);
  return { videos, images };
}

function claimsBlock(
  claims: readonly ShipClaim[],
  sections: readonly ShipClaim["section"][],
  sources: readonly SourceEntry[],
) {
  const cite = (url: string): number =>
    sources.findIndex((s) => s.href === url) + 1;
  return (
    <Claims
      claims={claims.filter((c) => sections.includes(c.section))}
      cite={cite}
    />
  );
}

const scaleLineup = (
  name: string,
  current: { key: string; length: number; height: number },
  others: readonly ShipView[],
) => (
  <ScaleLineup
    label={`${name} drawn to scale beside the other ships on record and a person`}
    items={[
      ...others.flatMap((o) =>
        o.stats === null || o.vehicle.class_name === current.key
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
      {
        key: current.key,
        name,
        length: current.length,
        height: current.height,
        current: true,
      },
    ]}
    reference={{ key: "person", name: "A person", length: 0.5, height: 1.8 }}
  />
);

export function packShipFile(ship: ShipView): ShipFileProps {
  const r = repo();
  const v = ship.vehicle;
  const s = ship.stats;
  const status = vehicleStatusBadge(v.status);
  const show = showcaseFor(v.slug, v.name);
  const claims = claimsFor(v.slug);
  const maker = ship.manufacturer;
  const version = s?.game_version ?? r.liveVersion ?? null;
  const groups = loadoutGroups(
    r.shipPorts(v.class_name),
    (cls) => r.componentByClass(cls)?.stats ?? null,
  );
  const arms = armament(groups);
  const allPorts = flattenPorts(r.shipPorts(v.class_name));
  const ports = allPorts.filter(
    ({ node }) => node.port.port_type !== "other" || node.item !== null,
  );
  const others = r.ships.filter((o) => o.stats !== null);
  const variants = r.variantsOf(v.class_name);
  const image = media().ship(v.class_name, v.name);
  const rankOf = (
    pick: (o: ShipView) => number | null,
    value: number | null,
  ): number | null => {
    if (value === null) return null;
    return rankAmong(
      others.flatMap((o) => {
        const x = pick(o);
        return x === null ? [] : [x];
      }),
      value,
    );
  };
  const rankValues = (pick: (o: ShipView) => number | null) =>
    others.flatMap((o) => {
      const x = pick(o);
      return x === null
        ? []
        : [
            {
              key: o.vehicle.class_name,
              name: o.vehicle.name,
              value: x,
              current: o.vehicle.class_name === v.class_name,
            },
          ];
    });

  const sources = sourceList(show, [
    {
      text: WIKI_CREDIT.text.replace(/\.$/, ""),
      href: WIKI_CREDIT.url,
      note: `Game data, LIVE ${version ?? ""}`,
    },
    ...(image === null
      ? []
      : [{ text: "RSI ship page and image", href: image.credit.href }]),
  ]);

  const guns = arms.find((a) => a.kind === "guns");
  const missiles = arms.find((a) => a.kind === "missiles");
  const shields = equipment(groups, ["shield"]);
  const quantum = equipment(groups, ["quantum_drive"]);
  const utility = groups.find((g) => g.id === "utility");
  const sizes = (row: typeof guns): string =>
    row === undefined
      ? "None"
      : `${row.total} (${row.sizes.map((x) => `${x.count} × S${x.size}`).join(", ")})`;

  const brief: string[] = [
    `The ${v.name} is a ${v.size_class === null ? "" : `${v.size_class} `}${(v.role ?? "ship").toLowerCase()} built by ${maker?.name ?? v.manufacturer_code}. ${
      v.status === "flight_ready"
        ? `It is flight ready in LIVE ${version ?? ""}.`
        : v.status === "in_production"
          ? "It is in production and not yet flyable."
          : "It is in concept and not flyable."
    }`,
  ];
  if (s !== null) {
    brief.push(
      `It is ${formatNumber(s.length_m, 2)} m long and ${n0(s.mass_kg)} kg, needs a crew of ${crewRange(s.crew_min, s.crew_max)}, and carries ${s.cargo_scu === null ? "no recorded" : n0(s.cargo_scu)} SCU of cargo.`,
    );
    const parts = [
      rankWord(
        rankOf((o) => o.stats?.length_m ?? null, s.length_m) ?? 0,
        "longest",
      ),
      rankWord(
        rankOf((o) => o.stats?.mass_kg ?? null, s.mass_kg) ?? 0,
        "heaviest",
      ),
      ...(s.scm_speed === null
        ? []
        : [
            `${rankWord(rankOf((o) => o.stats?.scm_speed ?? null, s.scm_speed) ?? 0, "fastest")} at SCM speed`,
          ]),
    ];
    brief.push(
      `Of the ${others.length} ships on record it is the ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.`,
    );
  }
  if (guns !== undefined || missiles !== undefined) {
    brief.push(
      `Stock armament: ${guns?.total ?? 0} guns and ${missiles?.total ?? 0} missiles${shields.length === 0 ? "" : `, behind ${shields.reduce((n, x) => n + x.count, 0)} shield generators`}.`,
    );
  }

  const acquisition: Fact[] = [
    { label: "Status", value: status.label },
    {
      label: "In the game since",
      value: v.first_seen_version ?? "Not recorded",
      numeric: true,
    },
    {
      label: "Revealed",
      value: show?.article?.published_at.slice(0, 10) ?? "Not on file",
      numeric: show?.article != null,
    },
    {
      label: "Variants",
      value:
        variants.length === 0
          ? "None on record"
          : variants.map((x) => x.vehicle.name).join(", "),
    },
    {
      label: "Paints",
      value:
        ship.paints.length === 0
          ? "None on record"
          : String(ship.paints.length),
      numeric: ship.paints.length > 0,
    },
    { label: "Shops and prices", value: "Not in our data yet" },
  ];

  const operations: Fact[] = [
    ...(s === null
      ? []
      : [
          {
            label: "Crew",
            value: crewRange(s.crew_min, s.crew_max),
            numeric: true,
          },
          ...(s.cargo_scu === null
            ? []
            : [
                {
                  label: "Cargo",
                  value: `${n0(s.cargo_scu)} SCU, ${rankWord(rankOf((o) => o.stats?.cargo_scu ?? null, s.cargo_scu) ?? 0, "largest")} of ${others.length}`,
                },
              ]),
        ]),
    { label: "Role", value: v.role ?? "Not stated" },
    {
      label: "Turrets",
      value: String(portCount(groups, ["turret"])),
      numeric: true,
    },
    {
      label: "Utility",
      value:
        utility === undefined || utility.entries.length === 0
          ? "None on the stock loadout"
          : utility.entries
              .map(
                (e) => `${e.count} × ${e.item?.name ?? sentence(e.portType)}`,
              )
              .join(", "),
    },
  ];

  const combat: Fact[] = [
    { label: "Guns", value: sizes(guns) },
    { label: "Missiles", value: sizes(missiles) },
    {
      label: "Shields",
      value:
        shields.length === 0
          ? "None on the stock loadout"
          : listEquipment(shields),
    },
    {
      label: "Countermeasures",
      value: String(portCount(groups, ["countermeasure"])),
      numeric: true,
    },
    ...(s?.hull_hp == null
      ? []
      : [{ label: "Hull", value: `${n0(s.hull_hp)} HP`, numeric: true }]),
  ];

  const mobility: Fact[] = [
    ...(s?.scm_speed == null
      ? []
      : [
          {
            label: "SCM speed",
            value: `${n0(s.scm_speed)} m/s`,
            numeric: true,
          },
        ]),
    ...(s?.nav_speed == null
      ? []
      : [
          {
            label: "NAV speed",
            value: `${n0(s.nav_speed)} m/s`,
            numeric: true,
          },
        ]),
    {
      label: "Quantum drive",
      value:
        quantum.length === 0
          ? "None on the stock loadout"
          : listEquipment(quantum),
    },
    ...(s === null
      ? []
      : [{ label: "Mass", value: `${n0(s.mass_kg)} kg`, numeric: true }]),
  ];

  const media_ = mediaOf(
    show,
    image === null
      ? null
      : {
          picture: {
            src: image.src,
            srcSet: image.srcSet,
            width: image.width,
            height: image.height,
            alt: image.alt,
          },
          caption: "Official image",
        },
  );

  return {
    name: v.name,
    file: fileNumber(v.manufacturer_code, v.slug),
    maker:
      maker === null
        ? null
        : { name: maker.name, href: `/manufacturers/${maker.slug}` },
    role: v.role,
    status,
    mark: maker === null ? null : media().maker(maker.code, maker.name),
    compareSlug: v.slug,
    visual: {
      model: show?.model ?? null,
      poster: show?.poster?.src ?? image?.src ?? null,
      length: s?.length_m ?? null,
      art:
        show?.background != null
          ? { background: show.background, cutout: show.cutout }
          : image === null
            ? null
            : {
                background: {
                  src: image.src,
                  srcSet: image.srcSet,
                  width: image.width,
                  height: image.height,
                  alt: image.alt,
                },
                cutout: null,
              },
      modelCredit: SHOWCASE_CREDITS.model,
    },
    particulars: [
      ["Length", s === null ? null : formatNumber(s.length_m, 2), "m"],
      ["Beam", s === null ? null : formatNumber(s.beam_m, 2), "m"],
      ["Height", s === null ? null : formatNumber(s.height_m, 2), "m"],
      ["Mass", s === null ? null : n0(s.mass_kg), "kg"],
      [
        "Crew",
        s === null ? null : crewRange(s.crew_min, s.crew_max),
        undefined,
      ],
      ["Cargo", s?.cargo_scu == null ? null : n0(s.cargo_scu), "SCU"],
      ["SCM speed", s?.scm_speed == null ? null : n0(s.scm_speed), "m/s"],
      ["NAV speed", s?.nav_speed == null ? null : n0(s.nav_speed), "m/s"],
      ["Hull", s?.hull_hp == null ? null : n0(s.hull_hp), "HP"],
      [
        "Size",
        v.size_class === null ? null : sentence(v.size_class),
        undefined,
      ],
    ].map(([label, value, unit]) =>
      value === null
        ? { label: label as string, value: "Not on file" }
        : {
            label: label as string,
            value: value as string,
            unit: unit as string | undefined,
            numeric: label !== "Size",
          },
    ),
    particularsSource: `Game data, LIVE ${version ?? ""}, via the Star Citizen Wiki API [${sources.findIndex((x) => x.href === WIKI_CREDIT.url) + 1}]`,
    sections: {
      brief: {
        body: (
          <div className="flex max-w-prose flex-col gap-3">
            {brief.map((p) => (
              <p key={p.slice(0, 32)} className="m-0 text-body text-primary">
                {p}
              </p>
            ))}
            {ship.description === null ? null : (
              <figure className="m-0 flex flex-col gap-1 border-l border-hairline-strong pl-4">
                <blockquote className="m-0 text-ui text-secondary">
                  {ship.description.text}
                </blockquote>
                <figcaption className="text-caption text-muted">
                  In-game description, {ship.description.channel}{" "}
                  {ship.description.game_version}
                </figcaption>
              </figure>
            )}
          </div>
        ),
      },
      acquisition: {
        body: (
          <div className="flex flex-col gap-3">
            <Facts facts={acquisition} />
            {image === null ? null : (
              <p className="m-0 text-caption text-secondary">
                Official page:{" "}
                <TextLink
                  href={image.credit.href}
                  external
                  className="text-secondary"
                >
                  {v.name} on robertsspaceindustries.com
                </TextLink>
              </p>
            )}
          </div>
        ),
      },
      operations: {
        body: (
          <div className="flex flex-col gap-4">
            <Facts facts={operations} />
            {claimsBlock(
              claims,
              ["operations", "command", "logistics"],
              sources,
            )}
          </div>
        ),
      },
      combat: {
        aside: "Stock loadout",
        body: (
          <div className="flex flex-col gap-6">
            <Facts facts={combat} />
            {arms.length === 0 ? null : <ArmamentStrip rows={arms} />}
            {claimsBlock(claims, ["combat"], sources)}
            {s === null ? null : (
              <div className="flex flex-col">
                <RankBar
                  label="Hull"
                  unit="HP"
                  most="Toughest"
                  scale="log"
                  values={rankValues((o) => o.stats?.hull_hp ?? null)}
                />
                <RankBar
                  label="Mass"
                  unit="kg"
                  most="Heaviest"
                  scale="log"
                  values={rankValues((o) => o.stats?.mass_kg ?? null)}
                />
              </div>
            )}
          </div>
        ),
      },
      mobility: {
        body: (
          <div className="flex flex-col gap-6">
            <Facts facts={mobility} />
            {s === null ? null : (
              <div className="flex flex-col">
                <RankBar
                  label="SCM speed"
                  unit="m/s"
                  most="Fastest"
                  values={rankValues((o) => o.stats?.scm_speed ?? null)}
                />
                <RankBar
                  label="NAV speed"
                  unit="m/s"
                  most="Fastest"
                  values={rankValues((o) => o.stats?.nav_speed ?? null)}
                />
              </div>
            )}
          </div>
        ),
      },
      scale: {
        aside:
          s === null
            ? undefined
            : `${formatNumber(s.length_m, 2)} m nose to tail`,
        body:
          s === null ? (
            <Gap>No dimensions on record.</Gap>
          ) : (
            scaleLineup(
              v.name,
              { key: v.class_name, length: s.length_m, height: s.height_m },
              others,
            )
          ),
      },
      imagery: {
        aside: `${media_.videos.length + media_.images.length} items`,
        body: (
          <MediaWall
            section={section("imagery")}
            videos={media_.videos}
            images={media_.images}
          />
        ),
      },
      specifications: {
        aside:
          version === null
            ? undefined
            : r.ptuVersion === null
              ? `LIVE ${version}`
              : `LIVE ${version} · PTU ${r.ptuVersion}`,
        body:
          s === null ? (
            <Gap>No LIVE stats are on record for this ship yet.</Gap>
          ) : (
            <StatsByChannel
              rows={shipSpecRows(ship)}
              ptuVersion={r.ptuVersion}
              hasPtuRow={ship.ptu !== null}
            />
          ),
      },
      hardpoints: {
        aside: `${ports.length} of ${allPorts.length} ports`,
        body:
          ports.length === 0 ? (
            <Gap>No hardpoints are on record for this ship yet.</Gap>
          ) : (
            <div className="flex flex-col gap-4">
              <LoadoutPanels groups={groups} />
              <details className="rounded-card border border-hairline bg-surface">
                <summary className="cursor-pointer rounded-card px-4 py-3 text-ui text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                  All {ports.length} ports by game name
                </summary>
                <div className="border-t border-hairline px-4 pb-4">
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
                </div>
              </details>
            </div>
          ),
      },
      sources: { body: <Sources sources={sources} /> },
    },
  };
}

export function conceptShipFile(concept: ConceptShip): ShipFileProps {
  const r = repo();
  const maker =
    r.manufacturers.find((m) => m.code === concept.manufacturer_code) ?? null;
  const show = showcaseFor(concept.slug, concept.name);
  const claims = claimsFor(concept.slug);
  const others = r.ships.filter((o) => o.stats !== null);
  const sources = sourceList(show, [
    {
      text: `RSI ship matrix, ${concept.name}`,
      href: concept.page_url,
      note: `Published figures, copied ${concept.fetched_at.slice(0, 10)}`,
    },
  ]);
  const matrix = sources.findIndex((x) => x.href === concept.page_url) + 1;
  const crew =
    concept.crew_min === null || concept.crew_max === null
      ? null
      : crewRange(concept.crew_min, concept.crew_max);
  const lengths = others
    .flatMap((o) =>
      o.stats === null
        ? []
        : [{ name: o.vehicle.name, length: o.stats.length_m }],
    )
    .sort((a, b) => b.length - a.length);
  const next = lengths[0];

  const brief: string[] = [
    `The ${concept.name} is a ${concept.size === null ? "" : `${concept.size} `}${(concept.focus ?? "ship").toLowerCase()} from ${maker?.name ?? concept.manufacturer_code}${show?.article == null ? "" : `, revealed on ${show.article.published_at.slice(0, 10)}`}. It is in concept: it cannot be flown and the game holds no data for it.`,
    `RSI's ship matrix lists it at ${concept.length_m === null ? "an unstated length" : `${n0(concept.length_m)} m long`}, with a crew of ${crew ?? "unstated size"} and ${concept.cargo_scu === null ? "unstated" : n0(concept.cargo_scu)} SCU of cargo.`,
  ];
  if (
    concept.length_m !== null &&
    next !== undefined &&
    concept.length_m > next.length
  ) {
    brief.push(
      `At that length it would be the longest ship on record here, ${(concept.length_m / next.length).toLocaleString("en-US", { maximumFractionDigits: 1 })} times the length of the next, the ${next.name}.`,
    );
  }
  brief.push(
    "Combat, mobility and loadout figures will come from the game files once it is built; until then the sections below list what CIG has stated, cited.",
  );

  const media_ = mediaOf(show, null);
  const notStated = "Not stated";
  return {
    name: concept.name,
    file: fileNumber(concept.manufacturer_code, concept.slug),
    maker:
      maker === null
        ? null
        : { name: maker.name, href: `/manufacturers/${maker.slug}` },
    role: concept.focus,
    status: vehicleStatusBadge("concept"),
    mark: maker === null ? null : media().maker(maker.code, maker.name),
    compareSlug: null,
    visual: {
      model: show?.model ?? null,
      poster: show?.poster?.src ?? null,
      length: concept.length_m,
      art:
        show?.background == null
          ? null
          : { background: show.background, cutout: show.cutout },
      modelCredit: SHOWCASE_CREDITS.model,
    },
    particulars: [
      {
        label: "Length",
        value: concept.length_m === null ? notStated : n0(concept.length_m),
        unit: concept.length_m === null ? undefined : "m",
        numeric: concept.length_m !== null,
      },
      {
        label: "Beam",
        value: concept.beam_m === null ? notStated : n0(concept.beam_m),
        unit: concept.beam_m === null ? undefined : "m",
        numeric: concept.beam_m !== null,
      },
      {
        label: "Height",
        value: concept.height_m === null ? notStated : n0(concept.height_m),
        unit: concept.height_m === null ? undefined : "m",
        numeric: concept.height_m !== null,
      },
      {
        label: "Mass",
        value: concept.mass_kg === null ? notStated : n0(concept.mass_kg),
        unit: concept.mass_kg === null ? undefined : "kg",
        numeric: concept.mass_kg !== null,
      },
      { label: "Crew", value: crew ?? notStated, numeric: crew !== null },
      {
        label: "Cargo",
        value: concept.cargo_scu === null ? notStated : n0(concept.cargo_scu),
        unit: concept.cargo_scu === null ? undefined : "SCU",
        numeric: concept.cargo_scu !== null,
      },
      {
        label: "SCM speed",
        value: concept.scm_speed === null ? notStated : n0(concept.scm_speed),
        unit: concept.scm_speed === null ? undefined : "m/s",
        numeric: concept.scm_speed !== null,
      },
      { label: "NAV speed", value: notStated },
      { label: "Hull", value: "Not in the game" },
      {
        label: "Size",
        value: concept.size === null ? notStated : sentence(concept.size),
      },
    ],
    particularsSource: `RSI ship matrix [${matrix}]. In concept: no game data yet.`,
    sections: {
      brief: {
        body: (
          <div className="flex max-w-prose flex-col gap-3">
            {brief.map((p) => (
              <p key={p.slice(0, 32)} className="m-0 text-body text-primary">
                {p}
              </p>
            ))}
          </div>
        ),
      },
      acquisition: {
        body: (
          <div className="flex flex-col gap-3">
            <Facts
              facts={[
                { label: "Status", value: "Concept" },
                { label: "In the game since", value: "Not in the game" },
                {
                  label: "Revealed",
                  value:
                    show?.article?.published_at.slice(0, 10) ?? "Not on file",
                  numeric: show?.article != null,
                },
                { label: "Variants", value: "None on record" },
                { label: "Flyable", value: "No" },
                { label: "Shops and prices", value: "Not sold in the game" },
              ]}
            />
            <p className="m-0 text-caption text-secondary">
              Official page:{" "}
              <TextLink
                href={concept.page_url}
                external
                className="text-secondary"
              >
                {concept.name} on robertsspaceindustries.com
              </TextLink>
            </p>
          </div>
        ),
      },
      operations: {
        body: (
          <div className="flex flex-col gap-4">
            <Facts
              facts={[
                {
                  label: "Crew",
                  value: crew ?? notStated,
                  numeric: crew !== null,
                },
                {
                  label: "Cargo",
                  value:
                    concept.cargo_scu === null
                      ? notStated
                      : `${n0(concept.cargo_scu)} SCU (ship matrix)`,
                },
                { label: "Role", value: concept.focus ?? notStated },
              ]}
            />
            {claimsBlock(
              claims,
              ["operations", "command", "logistics"],
              sources,
            )}
          </div>
        ),
      },
      combat: {
        body: (
          <div className="flex flex-col gap-4">
            <Gap>
              Not in the game data yet: no loadout, shields or hull figures.
            </Gap>
            {claimsBlock(claims, ["combat"], sources)}
          </div>
        ),
      },
      mobility: {
        body: (
          <Facts
            facts={[
              {
                label: "SCM speed",
                value:
                  concept.scm_speed === null
                    ? notStated
                    : `${n0(concept.scm_speed)} m/s`,
              },
              { label: "NAV speed", value: notStated },
              { label: "Quantum drive", value: "Not in the game data yet" },
              {
                label: "Mass",
                value:
                  concept.mass_kg === null
                    ? notStated
                    : `${n0(concept.mass_kg)} kg`,
              },
            ]}
          />
        ),
      },
      scale: {
        aside:
          concept.length_m === null
            ? undefined
            : `${n0(concept.length_m)} m nose to tail`,
        body:
          concept.length_m === null || concept.height_m === null ? (
            <Gap>No dimensions stated.</Gap>
          ) : (
            scaleLineup(
              concept.name,
              {
                key: concept.slug,
                length: concept.length_m,
                height: concept.height_m,
              },
              others,
            )
          ),
      },
      imagery: {
        aside: `${media_.videos.length + media_.images.length} items`,
        body: (
          <MediaWall
            section={section("imagery")}
            videos={media_.videos}
            images={media_.images}
          />
        ),
      },
      specifications: {
        body: (
          <Gap>
            Not in the game data yet. Specifications by build appear once the
            ship is in the game files.
          </Gap>
        ),
      },
      hardpoints: {
        body: (
          <Gap>
            Not in the game data yet. The hardpoints and stock loadout come from
            the game files.
          </Gap>
        ),
      },
      sources: { body: <Sources sources={sources} /> },
    },
  };
}
