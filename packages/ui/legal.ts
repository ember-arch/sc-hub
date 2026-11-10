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

/**
 * docs/legal/attribution.md, "UEX Corp" row (ADR-013): wherever in-game shop prices appear, and on
 * the about page. `notice` is UEX's own wording from its site footer.
 */
export const UEX_CREDIT = {
  text: "In-game shop prices: UEX Corp community reports (uexcorp.space), via the Star Citizen Wiki API.",
  notice: "Data is community-maintained and may not reflect live servers.",
  url: "https://uexcorp.space/",
} as const;

/** docs/legal/attribution.md, "Ship fitting list" row (ADR-028): community-tested, never a game stat. */
export const FITTING_CREDIT = {
  text: "Which ships fit inside which: the Star Citizen Ship Fitting List by u/Pegaxsus, tested in play by its author and the community.",
  notice:
    "Community-tested, not game data; a ship may fit differently after a patch.",
  url: "https://docs.google.com/spreadsheets/d/15wiwmRnwqzBDpFF0B02ifxHH3OqNe0CLAtL8NU3hefc/edit",
} as const;

/** docs/legal/attribution.md, "RSI pledge store" row (ADR-013). No referral codes, ever. */
export const PLEDGE_STORE_CREDIT = {
  text: "Pledge prices: the Roberts Space Industries pledge store.",
  url: "https://robertsspaceindustries.com/pledge",
} as const;

/** docs/legal/attribution.md, "RSI holoviewer models" row (ADR-015). */
export const RSI_HOLO_CREDIT = {
  text: "3D models: Roberts Space Industries' holoviewer, from each ship's pledge page.",
  url: "https://robertsspaceindustries.com/pledge",
} as const;

/**
 * docs/legal/attribution.md, "Wiki gallery pictures" row (ADR-024): the opening band of a ship file
 * whose showcase is the wiki's gallery, linked to the article. The official pictures are CIG's
 * art; the in-game ones are screenshots by the wiki's contributors.
 */
export const WIKI_GALLERY_CREDIT = {
  text: "Images: Roberts Space Industries, via the Star Citizen Wiki; in-game shots by the wiki's contributors",
} as const;

/** docs/legal/attribution.md, "RSI loaner ship matrix" row (ADR-015). */
export const LOANER_MATRIX_CREDIT = {
  text: "Loaners: the Roberts Space Industries loaner ship matrix, checked weekly.",
  url: "https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix",
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
 * The notice the Fankit Agreement, clause 2(g), requires wherever fankit assets appear, copied
 * verbatim (double full stop included) from 06_Fankit_Agreement_2025_11_19.pdf in the fankit
 * downloaded 2026-11-07. The footer carries it on every page (ADR-009).
 */
export const FANKIT_NOTICE =
  "This site is not endorsed by or affiliated with the Cloud Imperium or Roberts Space Industries group of companies. All game content and materials are copyright Cloud Imperium Rights LLC and Cloud Imperium Rights Ltd.. Star Citizen®, Squadron 42®, Roberts Space Industries®, and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC. All rights reserved.";

export const FANKIT_NOTICE_SOURCE = {
  document: "Fankit Agreement, clause 2(g)",
  fankitVersion: "2025_11_19",
  copiedOn: "2026-11-07",
} as const;

/** Under every ship image copied from RSI's ship matrix, linked to the ship's RSI page (ADR-009). */
export const RSI_IMAGE_CREDIT = {
  text: "Image: Roberts Space Industries",
} as const;

/**
 * The published contact address for corrections and takedowns (docs/legal/takedown.md). The owner
 * has not chosen one yet, so the footer and about page show that it is not yet published.
 */
export const CONTACT_EMAIL: string | null = null;

/** One sentence the about page must state plainly (docs/legal/attribution.md). */
export const ABOUT_STATEMENT =
  "This site is a fan project built by one person and has no affiliation with Cloud Imperium Games or Roberts Space Industries.";

/**
 * The titles page's text source (ADR-017, docs/legal/attribution.md). The wiki's sentences are
 * CC BY-SA 4.0: credited to the article and its contributors, with the licence linked, on the
 * titles page and the about page, and they stay under that licence.
 */
export const TITLES_TEXT_CREDIT = {
  text: "Titles and how each is earned: the Star Citizen Wiki's Titles article (starcitizen.tools), by its contributors, CC BY-SA 4.0.",
  url: "https://starcitizen.tools/Titles",
  historyUrl: "https://starcitizen.tools/index.php?title=Titles&action=history",
  licence: "CC BY-SA 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  changes:
    "Changes: the tables rearranged into tiles, a grid and cards; section headings shortened; the tick and cross marks shown as words; wiki markup, formatting, footnote numbers and links to other wiki pages removed; links to other sites kept.",
} as const;

/**
 * The funding page follows the measures of Sycend's Tableau dashboard (ADR-018): the breakdown by
 * year and month, the year-against-year running totals and the trailing-year comparison. None of
 * its data is used (its downloads are off); the credit is for the idea, on the page and the about page.
 */
export const FUNDING_INSPIRATION = {
  text: "The measures follow Sycend's Star Citizen Funding Dashboard on Tableau Public, which this page is modelled on; its data is its own and not used here.",
  linkText: "Star Citizen Funding Dashboard by Sycend",
  url: "https://public.tableau.com/app/profile/sycend/viz/StarCitizenFundingDashboard/IncomeView",
} as const;

/** Shown on the titles page only while icons are built locally (ADR-017); never deployed. */
export const TITLE_ICON_CREDIT = {
  text: "Icons: Cloud Imperium Games' art, copied from the Star Citizen Wiki's uploads for local development.",
} as const;
