/**
 * The User-Agent every dev script and the daily refresh send (CLAUDE.md section 9), in the form
 * docs/legal/obligations.md asks for: the site's name and version, its about page and the
 * contact address, built by `userAgent` in `packages/schema/site.ts` so the scripts and the news
 * workers send the same header (ADR-036). The owner chose ventures@coppercork.com on 2026-11-10
 * (ADR-033); scripts read it from SC_HUB_CONTACT_EMAIL, and a script that calls RSI halts
 * without it.
 */
import { userAgent as build } from "schema/site";

const contact = (): string | null => {
  const value = process.env["SC_HUB_CONTACT_EMAIL"]?.trim();
  return value === undefined || value === "" ? null : value;
};

export function userAgent(tool: string): string {
  return build(tool, contact());
}

/** For requests to RSI's sites, which CLAUDE.md section 9 asks to carry a contact email. */
export function rsiUserAgent(tool: string): string {
  if (contact() === null) {
    throw new Error(
      "Set SC_HUB_CONTACT_EMAIL to the project's contact address: CLAUDE.md section 9 asks RSI requests to carry one.",
    );
  }
  return userAgent(tool);
}
