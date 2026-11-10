/**
 * RSI's holoviewer (ADR-015, ADR-025): every ship's model address comes from the store's listing
 * (`store.ts`, read by `fetch-holo.ts`); the one fixed address is the human figure the viewer
 * stands beside every ship for scale.
 */

/** The human figure RSI's holoviewer stands beside every ship. */
export const HOLO_FIGURE = {
  slug: "person",
  url: "https://cdn.robertsspaceindustries.com/static/ctm/man.ctm",
} as const;
