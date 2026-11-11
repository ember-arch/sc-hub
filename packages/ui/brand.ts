import { SITE_NAME } from "schema/site";

/**
 * The project name is undecided (CLAUDE.md section 12); "SC Hub" is the working title. It is
 * written once, in `packages/schema/site.ts`, so the fetchers' User-Agent carries the same name
 * as the pages (ADR-036); the pages import it from here. Page titles read "<entity> — <site name>"
 * (docs/legal/obligations.md).
 */
export { SITE_NAME };

/** Short line under the name on the home page and in the metadata description. */
export const SITE_TAGLINE =
  "A fan reference for Star Citizen ships, components, news and developer posts.";

export const OFFICIAL_SITE_URL = "https://robertsspaceindustries.com/";

export const pageTitle = (entity: string): string => `${entity} — ${SITE_NAME}`;
