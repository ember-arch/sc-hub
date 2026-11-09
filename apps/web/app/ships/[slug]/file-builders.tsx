import type { ReactNode } from "react";
import type { ConceptShip, HoloModel } from "schema";
import {
  RankBar,
  ScaleLineup,
  StatsByChannel,
  TextLink,
  formatDate,
  formatNumber,
  sentence,
  vehicleStatusBadge,
} from "ui";
import { PLEDGE_STORE_CREDIT, UEX_CREDIT, WIKI_CREDIT } from "ui/legal";
import {
  type Acquisition,
  OFFER_KIND,
  type LoanerView,
  acquisitionFor,
  loanerFor,
  loanerValue,
  lowestShopPrice,
  pledgeValue,
  shopRows,
} from "../../../lib/acquisition";
import { armament, armamentPlan } from "../../../lib/armament";
import { combatPeers } from "../../../lib/combat";
import { type ShipView, flattenPorts, repo } from "../../../lib/data";
import { loadoutGroups } from "../../../lib/loadout";
import {
  editorModel,
  optionStats,
  partKind,
} from "../../../lib/loadout-editor";
import { media } from "../../../lib/media";
import {
  type Fact,
  type ShipClaim,
  claimsFor,
  equipment,
  insuranceOf,
  listEquipment,
  portCount,
  rankAmong,
  rankWord,
} from "../../../lib/ship-file";
import {
  SHOWCASE_CREDITS,
  type ShowcaseView,
  conceptShips,
  showcaseFor,
} from "../../../lib/showcase";
import { crewRange, shipSpecRows } from "../../../lib/views";
import { type PledgeRow, PledgeTable, ShopTable } from "./acquisition-tables";
import { ArmamentPlan } from "./armament-plan";
import { LoadoutEditor } from "./loadout-editor";
import { LoadoutPanels } from "./loadout-panels";
import { PortTable } from "./port-table";
import { type SourceEntry, Sources } from "./showcase/dossier";
import { HoloLineup, type LineupShip } from "./showcase/holo-lineup";
import { Claims, Facts, Gap, Related, type ShipFileProps } from "./ship-file";

/**
 * Builds a ship file (ADR-012) for a ship in the pack or a concept ship. Both produce the same ten
 * sections in the same order; the wording is composed from the data, never copied from RSI's sales
 * text. Where data is missing the section says so, and CIG's stated claims are listed and cited.
 */

const fileNumber = (code: string, slug: string): string =>
  `${code}-${slug.toUpperCase()}`;

const n0 = (v: number): string => formatNumber(v);

/** The opening band's credit: the Comm-Link the key art comes from (ADR-010). */
function artCredit(show: ShowcaseView): { text: string; href: string } {
  return show.article === null
    ? {
        text: "Art: Roberts Space Industries",
        href: "https://robertsspaceindustries.com/",
      }
    : { text: "Art: Roberts Space Industries", href: show.article.url };
}

/** The maker's other ships and the ships with the same role (spec 02, "Ship page": related). */
function relatedTo(
  makerCode: string,
  className: string | null,
  role: string | null,
) {
  const r = repo();
  const link = (o: ShipView) => ({
    name: o.vehicle.name,
    href: `/ships/${o.vehicle.slug}`,
  });
  const maker =
    r.manufacturers.find((m) => m.code === makerCode)?.name ?? makerCode;
  return [
    {
      title: `More from ${maker}`,
      ships: r
        .lineup(makerCode)
        .filter((o) => o.vehicle.class_name !== className)
        .map(link),
    },
    {
      title: role === null ? "Same role" : `Other ${role.toLowerCase()} ships`,
      ships:
        role === null
          ? []
          : r.ships
              .filter(
                (o) =>
                  o.vehicle.class_name !== className && o.vehicle.role === role,
              )
              .map(link),
    },
  ];
}

/** The holoviewer's model and the person beside it (ADR-015), with the model's credit. */
function holoVisual(slug: string): {
  model: ShipFileProps["visual"]["model"];
  modelCredit: { text: string; href: string };
} {
  const holo = media().holo(slug);
  const figure = media().holoFigure();
  return {
    model:
      holo === null
        ? null
        : {
            src: holo.src,
            bytes: holo.bytes,
            figure:
              figure === null
                ? null
                : { src: figure.src, height: figure.height },
          },
    modelCredit:
      holo === null
        ? SHOWCASE_CREDITS.model
        : { text: "Model: RSI holoviewer", href: holo.page },
  };
}

/**
 * Sources in a fixed order; claims and captions cite them by number. A claim's article is listed
 * from the claim itself, so its citation holds when no media is built (CI, a deploy).
 */
function sourceList(
  show: ShowcaseView | null,
  extra: readonly SourceEntry[],
  holo: HoloModel | null,
  claims: readonly ShipClaim[] = [],
): SourceEntry[] {
  const articles = [
    ...new Map(claims.map((c) => [c.source_url, c])).values(),
  ].filter((c) => c.source_url !== show?.article?.url);
  return [
    ...articles.map((c) => ({
      text: `Roberts Space Industries, Comm-Link "${c.source_title}", ${c.published_at.slice(0, 10)}`,
      href: c.source_url,
      note: "CIG's stated claims",
    })),
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
    ...(holo === null
      ? []
      : [
          {
            text: "RSI holoviewer model",
            href: holo.page,
            note: "3D model: the file the ship's RSI pledge page shows in its holoviewer",
          },
        ]),
    {
      text: "CIG fankit, manufacturer logo",
      href: "https://robertsspaceindustries.com/fankit",
    },
  ];
}

/** RSI's loaner matrix in the source list, when it is on file (ADR-015). */
function loanerSource(loaner: LoanerView | null): SourceEntry[] {
  return loaner === null
    ? []
    : [
        {
          text: "RSI loaner ship matrix",
          href: loaner.url,
          note: `Loaners, as RSI last updated them on ${loaner.editedOn}${loaner.build === null ? "" : ` for ${loaner.build}`}; checked weekly`,
        },
      ];
}

const plural = (n: number, one: string): string =>
  `${n} ${n === 1 ? one : `${one}s`}`;

function pledgeRows(acq: Acquisition): PledgeRow[] {
  return acq.offers.map((o, i) => ({
    key: `${o.url}-${i}`,
    title: o.title,
    kind:
      o.kind === "other"
        ? (o.store_section ?? OFFER_KIND.other)
        : OFFER_KIND[o.kind],
    price_usd: o.price_usd,
    warbond: o.warbond,
    available: o.available,
    observed_at: o.observed_at,
    url: o.url,
  }));
}

/** The pledge-store facts every ship file carries, in one order (ADR-013). */
function pledgeFacts(acq: Acquisition): Fact[] {
  const value = pledgeValue(acq.offers);
  const upgrades = acq.offers.filter((o) => o.kind === "upgrade");
  const packs = acq.offers.filter((o) => o.kind === "package");
  const packsOnSale = packs.filter((o) => o.available).length;
  return [
    {
      label: "Pledge, standalone",
      value:
        value === null
          ? "No standalone listing on file"
          : `${n0(value.price_usd)} USD, ${value.available ? "on sale" : `not on sale (read ${formatDate(value.observed_at)})`}`,
    },
    {
      label: "Upgrade to it",
      value:
        upgrades.length === 0
          ? "Not listed"
          : upgrades.some((o) => o.available)
            ? "On sale"
            : "Not on sale",
    },
    {
      label: "Packs containing it",
      value:
        packs.length === 0
          ? "None listed"
          : `${packs.length} listed, ${packsOnSale === 0 ? "none" : packsOnSale} on sale`,
    },
  ];
}

const heading = "m-0 text-heading text-primary";
const note = "m-0 text-caption text-secondary";

/** The two Acquisition tables: the pledge store, then the game's shop terminals (ADR-013). */
function StoreAndShops({
  acq,
  pledgeSource,
  uexSource,
  build,
}: {
  readonly acq: Acquisition;
  readonly pledgeSource: number;
  readonly uexSource: number;
  /** The LIVE build the shop reports are for, or "concept" for a ship not in the game. */
  readonly build: string | null;
}) {
  const pledge = pledgeRows(acq);
  const shops = shopRows(acq.shops);
  return (
    <>
      <div className="flex flex-col gap-3">
        <h3 className={heading}>Pledge store</h3>
        {pledge.length === 0 ? (
          <Gap>No pledge store listing on file.</Gap>
        ) : (
          <>
            <PledgeTable rows={pledge} />
            <p className={note}>
              US dollars as RSI lists them [{pledgeSource}]. Sales and warbond
              editions change them.
              {acq.offers.some((o) => o.kind === "upgrade")
                ? " An upgrade to this ship costs the difference from the ship it starts from."
                : null}
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className={heading}>In-game shops</h3>
        {build === "concept" ? (
          <Gap>Not sold or rented in the game: it is in concept.</Gap>
        ) : shops.length === 0 ? (
          <Gap>
            No shop terminal has been reported to UEX for LIVE {build ?? ""}.
          </Gap>
        ) : (
          <>
            <ShopTable rows={shops} />
            <p className={note}>
              Community reports to UEX Corp for LIVE {build ?? ""}, via the Star
              Citizen Wiki API [{uexSource}]. {UEX_CREDIT.notice} UEX lists one
              rental price per terminal without stating the period.
            </p>
          </>
        )}
      </div>
    </>
  );
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

/**
 * The Scale section (ADR-015): every ship with an RSI holoviewer model, lined up to scale in one
 * holoviewer canvas, the page's ship lit full. Without the models built (a clone, CI, a deploy),
 * or with no other ship to stand beside, the drawn lineup stays.
 */
function scaleView(slug: string, drawn: ReactNode): ReactNode {
  const r = repo();
  const ships: LineupShip[] = [
    ...r.ships.flatMap((o) => {
      const holo = media().holo(o.vehicle.slug);
      return holo === null || o.stats === null
        ? []
        : [
            {
              slug: o.vehicle.slug,
              name: o.vehicle.name,
              length: o.stats.length_m,
              src: holo.src,
              bytes: holo.bytes,
              current: o.vehicle.slug === slug,
            },
          ];
    }),
    ...conceptShips().flatMap((c) => {
      const holo = media().holo(c.slug);
      return holo === null || c.length_m === null
        ? []
        : [
            {
              slug: c.slug,
              name: c.name,
              length: c.length_m,
              src: holo.src,
              bytes: holo.bytes,
              current: c.slug === slug,
            },
          ];
    }),
  ];
  if (ships.length < 2 || !ships.some((s) => s.current)) return drawn;
  const figure = media().holoFigure();
  return (
    <HoloLineup
      ships={ships}
      figure={
        figure === null ? null : { src: figure.src, height: figure.height }
      }
      label="Fig. B"
      credit={{
        text: "Models: RSI holoviewer",
        href: "https://robertsspaceindustries.com/pledge",
      }}
    />
  );
}

export function packShipFile(ship: ShipView): ShipFileProps {
  const r = repo();
  const v = ship.vehicle;
  const s = ship.stats;
  const status = vehicleStatusBadge(v.status);
  const show = showcaseFor(v.slug, v.name);
  // CIG's stated claims stand in only where the game has no data (ADR-012): none for a pack ship.
  const claims: readonly ShipClaim[] = [];
  const maker = ship.manufacturer;
  const version = s?.game_version ?? r.liveVersion ?? null;
  const groups = loadoutGroups(
    r.shipPorts(v.class_name),
    (cls) => r.componentByClass(cls)?.stats ?? null,
  );
  const arms = armament(groups);
  const plan = armamentPlan(groups, (entry) => {
    const figures = optionStats(entry.stats);
    return entry.item?.type === "weapon"
      ? { damage: figures.dps, detail: partKind(entry.item, entry.stats) }
      : {
          damage: figures.damage,
          detail:
            figures.tracking === null ? null : `${figures.tracking} tracking`,
        };
  });
  const editor = editorModel(r.shipPorts(v.class_name), r.components);
  const allPorts = flattenPorts(r.shipPorts(v.class_name));
  const ports = allPorts.filter(
    ({ node }) => node.port.port_type !== "other" || node.item !== null,
  );
  const others = r.ships.filter((o) => o.stats !== null);
  const variants = r.variantsOf(v.class_name);
  const image = media().ship(v.class_name, v.name);
  const acq = acquisitionFor(v.slug, v.class_name);
  const loaner = loanerFor(v.name);
  const pledge = pledgeValue(acq.offers);
  const buy = lowestShopPrice(acq.shops, "purchase");
  const rent = lowestShopPrice(acq.shops, "rental");
  const insurance = insuranceOf(s?.raw);
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

  const sources = sourceList(
    show,
    [
      {
        text: WIKI_CREDIT.text.replace(/\.$/, ""),
        href: WIKI_CREDIT.url,
        note: `Game data, LIVE ${version ?? ""}`,
      },
      ...(image === null
        ? []
        : [{ text: "RSI ship page and image", href: image.credit.href }]),
      ...(acq.offers[0] === undefined
        ? []
        : [
            {
              text: "RSI pledge store, as the Star Citizen Wiki API relays it",
              href: PLEDGE_STORE_CREDIT.url,
              note: `Pledge prices, copied ${acq.offers[0].fetched_at.slice(0, 10)}`,
            },
          ]),
      ...(acq.shops[0] === undefined
        ? []
        : [
            {
              text: "UEX Corp, community price reports",
              href: UEX_CREDIT.url,
              note: `In-game shop prices for LIVE ${version ?? ""}, via the Star Citizen Wiki API, copied ${acq.shops[0].fetched_at.slice(0, 10)}`,
            },
          ]),
      ...loanerSource(loaner),
    ],
    media().holo(v.slug),
  );
  const cite = (href: string): number =>
    sources.findIndex((x) => x.href === href) + 1;

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
        ? `It is flight ready in LIVE ${(version ?? "").split("-")[0] ?? ""}.`
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
      links: variants.map((x) => ({
        label: x.vehicle.name,
        href: `/ships/${x.vehicle.slug}`,
      })),
    },
    {
      label: "Paints",
      value:
        ship.paints.length === 0
          ? "None on record"
          : String(ship.paints.length),
      numeric: ship.paints.length > 0,
    },
    ...pledgeFacts(acq),
    {
      label: "Buy in the game",
      value:
        buy === null
          ? "Not reported to UEX"
          : `From ${n0(buy.price_auec)} aUEC, ${plural(buy.terminals, "shop")}`,
    },
    {
      label: "Rent in the game",
      value:
        rent === null
          ? "Not reported to UEX"
          : `From ${n0(rent.price_auec)} aUEC, ${plural(rent.terminals, "shop")}`,
    },
    {
      label: "Insurance claim",
      value:
        insurance === null
          ? "Not in the game data"
          : `${formatNumber(insurance.claim_min, 2)} min`,
      numeric: insurance !== null,
    },
    {
      label: "Expedited claim",
      value:
        insurance === null
          ? "Not in the game data"
          : `${formatNumber(insurance.expedite_min, 2)} min for ${n0(insurance.expedite_auec)} aUEC`,
    },
    {
      label: "Loaners",
      value: loanerValue(loaner, v.status === "flight_ready"),
    },
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
    dek: brief[0] ?? "",
    figures: show?.figures ?? {},
    visual: {
      ...holoVisual(v.slug),
      poster: show?.poster?.src ?? image?.src ?? null,
      length: s?.length_m ?? null,
      art:
        show?.background != null
          ? {
              background: show.background,
              credit: artCredit(show),
            }
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
                credit: {
                  text: image.credit.text,
                  href: image.credit.href,
                },
              },
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
      ["Pledge", pledge === null ? null : n0(pledge.price_usd), "USD"],
      ["Buy in game", buy === null ? null : n0(buy.price_auec), "aUEC"],
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
    // Each row's own source: the pledge comes from RSI's store and the shop price from UEX Corp.
    particularsSource: [
      `Game data, LIVE ${version ?? ""}, via the Star Citizen Wiki API [${cite(WIKI_CREDIT.url)}]`,
      ...(pledge === null
        ? []
        : [
            `pledge from the RSI pledge store [${cite(PLEDGE_STORE_CREDIT.url)}]`,
          ]),
      ...(buy === null
        ? []
        : [`in-game price from UEX Corp [${cite(UEX_CREDIT.url)}]`]),
    ].join("; "),
    sections: {
      brief: {
        body: (
          <div className="flex max-w-prose flex-col gap-3">
            {brief.slice(1).map((p) => (
              <p
                key={p.slice(0, 32)}
                className="m-0 text-heading font-regular text-primary"
              >
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
          <div className="flex flex-col gap-6">
            <Facts facts={acquisition} />
            <StoreAndShops
              acq={acq}
              pledgeSource={cite(PLEDGE_STORE_CREDIT.url)}
              uexSource={cite(UEX_CREDIT.url)}
              build={version}
            />
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
        aside: version === null ? undefined : `LIVE ${version}`,
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
        aside:
          version === null ? "Stock loadout" : `Stock loadout, LIVE ${version}`,
        body: (
          <div className="flex flex-col gap-6">
            <Facts facts={combat} />
            {plan.length === 0 ? null : <ArmamentPlan mounts={plan} />}
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
        aside: version === null ? undefined : `LIVE ${version}`,
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
            scaleView(
              v.slug,
              scaleLineup(
                v.name,
                { key: v.class_name, length: s.length_m, height: s.height_m },
                others,
              ),
            )
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
        aside: `${version === null ? "" : `LIVE ${version} · `}${ports.length} of ${allPorts.length} ports`,
        body:
          ports.length === 0 ? (
            <Gap>No hardpoints are on record for this ship yet.</Gap>
          ) : (
            <div className="flex flex-col gap-4">
              {editor.slots.length === 0 ? null : (
                <LoadoutEditor
                  name={v.name}
                  slots={editor.slots}
                  options={editor.options}
                  peers={combatPeers(v.class_name)}
                />
              )}
              <details className="rounded-card bg-surface shadow-soft">
                <summary className="cursor-pointer rounded-card px-4 py-3 text-ui text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                  Every fitted part by system
                </summary>
                <div className="border-t border-hairline p-4">
                  <LoadoutPanels groups={groups} />
                </div>
              </details>
              <details className="rounded-card bg-surface shadow-soft">
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
      sources: {
        body: (
          <div className="flex flex-col gap-8">
            <Related
              groups={relatedTo(v.manufacturer_code, v.class_name, v.role)}
            />
            <Sources sources={sources} />
          </div>
        ),
      },
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
  const acq = acquisitionFor(concept.slug, null);
  const loaner = loanerFor(concept.name);
  const pledge = pledgeValue(acq.offers);
  const sources = sourceList(
    show,
    [
      {
        text: `RSI ship matrix, ${concept.name}`,
        href: concept.page_url,
        note: `Published figures, copied ${concept.fetched_at.slice(0, 10)}${acq.offers[0] === undefined ? "" : `; pledge price from the same page, copied ${acq.offers[0].fetched_at.slice(0, 10)}`}`,
      },
      ...loanerSource(loaner),
    ],
    media().holo(concept.slug),
    claims,
  );
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
    dek: brief[0] ?? "",
    figures: show?.figures ?? {},
    visual: {
      ...holoVisual(concept.slug),
      poster: show?.poster?.src ?? null,
      length: concept.length_m,
      art:
        show?.background == null
          ? null
          : {
              background: show.background,
              credit: artCredit(show),
            },
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
      {
        label: "Pledge",
        value: pledge === null ? "Not on file" : n0(pledge.price_usd),
        unit: pledge === null ? undefined : "USD",
        numeric: pledge !== null,
      },
      { label: "Buy in game", value: "Not in the game" },
    ],
    particularsSource: `RSI ship matrix [${matrix}]. In concept: no game data yet.`,
    sections: {
      brief: {
        body: (
          <div className="flex max-w-prose flex-col gap-3">
            {brief.slice(1).map((p) => (
              <p
                key={p.slice(0, 32)}
                className="m-0 text-heading font-regular text-primary"
              >
                {p}
              </p>
            ))}
          </div>
        ),
      },
      acquisition: {
        body: (
          <div className="flex flex-col gap-6">
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
                ...pledgeFacts(acq),
                { label: "Buy in the game", value: "Not in the game" },
                { label: "Rent in the game", value: "Not in the game" },
                {
                  label: "Insurance claim",
                  value: "Not in the game data yet",
                },
                {
                  label: "Expedited claim",
                  value: "Not in the game data yet",
                },
                { label: "Loaners", value: loanerValue(loaner, false) },
                { label: "Variants", value: "None on record" },
                { label: "Flyable", value: "No" },
              ]}
            />
            <StoreAndShops
              acq={acq}
              pledgeSource={matrix}
              uexSource={0}
              build="concept"
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
            scaleView(
              concept.slug,
              scaleLineup(
                concept.name,
                {
                  key: concept.slug,
                  length: concept.length_m,
                  height: concept.height_m,
                },
                others,
              ),
            )
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
      sources: {
        body: (
          <div className="flex flex-col gap-8">
            <Related
              groups={relatedTo(concept.manufacturer_code, null, null)}
            />
            <Sources sources={sources} />
          </div>
        ),
      },
    },
  };
}
