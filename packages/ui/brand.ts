/**
 * The project name is undecided (CLAUDE.md section 12); "SC Hub" is the working title and this
 * constant is its placeholder. Page titles read "<entity> — <site name>" (docs/legal/obligations.md).
 */
export const SITE_NAME = "SC Hub";

/** Short line under the name on the home page and in the metadata description. */
export const SITE_TAGLINE =
  "A fan reference for Star Citizen ships, components, news and developer posts.";

export const OFFICIAL_SITE_URL = "https://robertsspaceindustries.com/";

export const pageTitle = (entity: string): string => `${entity} — ${SITE_NAME}`;
