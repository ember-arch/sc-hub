/**
 * The site's public identity, in the one package every runtime already depends on (ADR-036),
 * imported as `schema/site` (not from the package root, which stays the data contract): the
 * name, the production origin, the about page, and the User-Agent every fetcher sends.
 * `packages/ui/brand.ts` re-exports the name for the pages; the dev scripts, the daily refresh
 * and the news workers build their User-Agent here, so the three cannot drift. No environment
 * is read in this module: callers pass the contact address they were given.
 */

/** The working title (CLAUDE.md section 12); the one place the name is written. */
export const SITE_NAME = "SC Hub";

/**
 * The canonical origin since the launch of 2026-11-10 (ADR-033). The pages resolve theirs from
 * `SITE_URL`; the fetchers use this constant, because they never run where `SITE_URL` points
 * anywhere else, and a header sent to a source should never carry a preview or local address.
 */
export const SITE_ORIGIN = "https://coppercork.com";

/** The page docs/legal/obligations.md asks every User-Agent to point at. */
export const ABOUT_PAGE_URL = `${SITE_ORIGIN}/about`;

/**
 * The `<version>` of the User-Agent: the first public release (ADR-033). Bump it when the site
 * changes in a way a source operator reading their logs would want to tell apart.
 */
export const SITE_VERSION = "1.0";

/** RFC 9110 `token`: what a User-Agent product name may contain. */
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** The site name as a product token: "SC Hub" is written "SC-Hub", since a token has no spaces. */
export const SITE_PRODUCT = SITE_NAME.replace(/\s+/g, "-");

/**
 * The User-Agent of docs/legal/obligations.md, `<site name>/<version> (+<about-page URL>;
 * <contact email>)`, followed by the job's name as a second product token so a source can tell
 * the pollers, the refresh and the dev scripts apart in its logs:
 *
 *     SC-Hub/1.0 (+https://coppercork.com/about; ventures@coppercork.com) poll-news
 *
 * `contact` is the `SC_HUB_CONTACT_EMAIL` the caller read; with `null` the address is left out,
 * and the callers that reach robertsspaceindustries.com refuse to run (CLAUDE.md section 9).
 */
export function userAgent(tool: string, contact: string | null): string {
  if (!TOKEN.test(tool)) {
    throw new Error(
      `User-Agent tool name ${JSON.stringify(tool)} is not an HTTP token (RFC 9110): no spaces, quotes, brackets or separators`,
    );
  }
  const comment =
    contact === null ? ABOUT_PAGE_URL : `${ABOUT_PAGE_URL}; ${contact}`;
  return `${SITE_PRODUCT}/${SITE_VERSION} (+${comment}) ${tool}`;
}
