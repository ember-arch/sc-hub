/**
 * The User-Agent every dev script sends (CLAUDE.md section 9): the project's name, that it is a
 * non-commercial fan reference, where it lives and, for robertsspaceindustries.com, a contact
 * email. The address is the owner's to choose (ADR-005, open); scripts read it from
 * SC_HUB_CONTACT_EMAIL, and a script that calls RSI halts without it.
 */

const contact = (): string | null => {
  const value = process.env["SC_HUB_CONTACT_EMAIL"]?.trim();
  return value === undefined || value === "" ? null : value;
};

export function userAgent(tool: string): string {
  const email = contact();
  return `sc-hub-${tool}/0.0 (non-commercial fan reference in development; github.com/ember-arch/sc-hub${email === null ? "" : `; ${email}`})`;
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
