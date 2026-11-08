/**
 * RSI's holoviewer models (ADR-015): the OpenCTM file each ship's RSI pledge page loads into its
 * holoviewer, and the human figure it stands beside the ship for scale. The URLs were read from
 * each pledge page's holoviewer on 2026-11-08; RSI's ship matrix does not list them.
 */

export interface HoloModel {
  /** The ship page slug: a pack slug, or a concept ship's slug. */
  readonly slug: string;
  readonly name: string;
  /** The RSI pledge page whose holoviewer shows this model. */
  readonly page: string;
  readonly url: string;
}

const PLEDGE = "https://robertsspaceindustries.com/en/pledge/ships";

export const HOLO_MODELS: readonly HoloModel[] = [
  {
    slug: "odin",
    name: "Odin",
    page: `${PLEDGE}/odin/Odin`,
    url: "https://media.robertsspaceindustries.com/mhwmpvt2e8h0w/source.ctm",
  },
  {
    slug: "perseus",
    name: "Perseus",
    page: `${PLEDGE}/perseus/Perseus`,
    url: "https://media.robertsspaceindustries.com/8734v3ynju5cc/source.ctm",
  },
  {
    slug: "gladius",
    name: "Gladius",
    page: `${PLEDGE}/gladius/Gladius`,
    url: "https://robertsspaceindustries.com/media/oibvdxxco2narr/source/AEGIS-Gladius2.ctm",
  },
  {
    slug: "carrack",
    name: "Carrack",
    page: `${PLEDGE}/carrack/Carrack`,
    url: "https://media.robertsspaceindustries.com/5d19z1ni409r5/source.ctm",
  },
  {
    slug: "cutlass-black",
    name: "Cutlass Black",
    page: `${PLEDGE}/drake-cutlass/Cutlass-Black`,
    url: "https://robertsspaceindustries.com/media/7w8rse7wgq0bir/source/DRAKE_CUTLASSBLACK.ctm",
  },
  {
    slug: "fury",
    name: "Fury",
    page: `${PLEDGE}/fury/Fury`,
    url: "https://media.robertsspaceindustries.com/kjtrayxqls6wk/source.ctm",
  },
  {
    slug: "polaris",
    name: "Polaris",
    page: `${PLEDGE}/polaris/Polaris`,
    url: "https://robertsspaceindustries.com/media/l8fs5ivw36mdvr/source/RSI-Polaris.ctm",
  },
];

/** The human figure RSI's holoviewer stands beside every ship. */
export const HOLO_FIGURE = {
  slug: "person",
  url: "https://cdn.robertsspaceindustries.com/static/ctm/man.ctm",
} as const;
