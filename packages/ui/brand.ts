import { SITE_NAME } from "schema/site";

/**
 * The site is Coppercork (ADR-041). The name is written once, in `packages/schema/site.ts`, so
 * the fetchers' User-Agent carries the same name as the pages (ADR-036); the pages import it from
 * here. Page titles read "<entity> — <site name>" (docs/legal/obligations.md).
 */
export { SITE_NAME };

/** What the site is, in one sentence (ADR-041): the metadata description, and the about page's first line follows it. */
export const SITE_TAGLINE =
  "Star Citizen, on record: every ship and part, the dispatches, what the developers say and how the funding grows, kept current.";

export const OFFICIAL_SITE_URL = "https://robertsspaceindustries.com/";

export const pageTitle = (entity: string): string => `${entity} — ${SITE_NAME}`;
