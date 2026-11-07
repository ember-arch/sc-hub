/**
 * The exact legal strings and where each came from (docs/legal/obligations.md, attribution.md).
 * Nothing here is paraphrased. The e2e suite asserts DISCLAIMER on five routes.
 */

/**
 * CIG's required fan-site notice, copied verbatim from the "Fan Sites" section of the Star Citizen
 * Fankit and Fandom FAQ. The same page says the notice must be open, obvious and readily seen, not
 * printed smaller than other notices, and that the site must link to the official site.
 */
export const DISCLAIMER =
  "This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies. All content on this site not authored by its host or users are property of their respective owners.";

export const DISCLAIMER_SOURCE = {
  url: "https://support.robertsspaceindustries.com/hc/en-us/articles/360006895793-Star-Citizen-Fankit-and-Fandom-FAQ",
  section: "Fan Sites",
  copiedOn: "2026-11-07",
} as const;

/** docs/legal/attribution.md, "CIG / RSI" row. */
export const TRADEMARK_LINE =
  "Star Citizen®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC.";

/** Shown wherever Star Citizen Wiki API data appears, and on the about page. */
export const WIKI_CREDIT = {
  text: "Some game data via the Star Citizen Wiki API (api.star-citizen.wiki).",
  url: "https://api.star-citizen.wiki/",
} as const;

export const STARBREAKER_CREDIT = {
  text: "Game data and models extracted with StarBreaker.",
  url: "https://github.com/hpbgithub/StarBreaker",
} as const;

export const UNP4K_CREDIT = {
  text: "Archive handling informed by unp4k.",
  url: "https://github.com/dolkensp/unp4k",
} as const;

export const FANKIT_CREDIT = { text: "Image: CIG fankit." } as const;

/**
 * The published contact address for corrections and takedowns (docs/legal/takedown.md). The owner
 * has not chosen one yet, so the footer and about page show that it is not yet published.
 */
export const CONTACT_EMAIL: string | null = null;

/** One sentence the about page must state plainly (docs/legal/attribution.md). */
export const ABOUT_STATEMENT =
  "This site is a fan project built by one person and has no affiliation with Cloud Imperium Games or Roberts Space Industries.";
