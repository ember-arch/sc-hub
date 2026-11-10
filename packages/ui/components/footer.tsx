import { OFFICIAL_SITE_URL, SITE_NAME } from "../brand";
import {
  CONTACT_EMAIL,
  DISCLAIMER,
  FANKIT_NOTICE,
  MADE_BY_THE_COMMUNITY,
  TRADEMARK_LINE,
  WIKI_CREDIT,
} from "../legal";
import { Mark } from "./media";
import { type ChannelVersion, PatchStrip } from "./patch-strip";
import { TextLink } from "./text-link";

export interface FooterProps {
  readonly versions: readonly ChannelVersion[];
  /** True while any data on the page came from the Star Citizen Wiki API (docs/legal/attribution.md). */
  readonly wikiCredit: boolean;
}

/**
 * Every page ends with this (CLAUDE.md section 2). The disclaimer is verbatim and set in the
 * interface size, not the caption size: CIG's FAQ says it must not be printed smaller than other
 * notices. The official-site link is also required by the same FAQ. The fankit notice is the
 * Fankit Agreement's, required wherever its assets appear (ADR-009). The "Made By The
 * Community" badge, the fankit's mark for fan projects, stands beside the notices on every
 * page (the owner's direction of 2026-11-10).
 */
export function Footer({ versions, wikiCredit }: FooterProps) {
  return (
    <footer className="mt-24 border-t border-hairline">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          <div className="shrink-0" data-testid="community-badge">
            <Mark
              mark={{
                alt: MADE_BY_THE_COMMUNITY.alt,
                onLight: MADE_BY_THE_COMMUNITY.onLight,
                onDark: MADE_BY_THE_COMMUNITY.onDark,
              }}
              heightClass="h-24"
            />
          </div>
          <div className="flex flex-col gap-6">
            <p
              className="max-w-prose text-ui text-primary"
              data-testid="disclaimer"
            >
              {DISCLAIMER}
            </p>
            <p className="max-w-prose text-ui text-secondary">
              {TRADEMARK_LINE}
            </p>
            <p
              className="max-w-prose text-ui text-secondary"
              data-testid="fankit-notice"
            >
              {FANKIT_NOTICE}
            </p>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-caption text-secondary">
          {wikiCredit ? (
            <li>
              <TextLink
                href={WIKI_CREDIT.url}
                external
                className="text-secondary"
              >
                {WIKI_CREDIT.text}
              </TextLink>
            </li>
          ) : null}
          <li>
            Official site:{" "}
            <TextLink href={OFFICIAL_SITE_URL} external>
              robertsspaceindustries.com
            </TextLink>
          </li>
          <li>
            {CONTACT_EMAIL === null ? (
              <span>
                Contact address for corrections and takedowns: not yet
                published.
              </span>
            ) : (
              <span>
                Corrections and takedowns:{" "}
                <TextLink href={`mailto:${CONTACT_EMAIL}`} external>
                  {CONTACT_EMAIL}
                </TextLink>
              </span>
            )}
          </li>
        </ul>
        <nav aria-label="Legal" className="flex flex-wrap gap-4 text-caption">
          <TextLink href="/about">About</TextLink>
          <TextLink href="/privacy">Privacy</TextLink>
          <TextLink href="/licenses">Licenses</TextLink>
        </nav>
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-hairline pt-6">
          <PatchStrip versions={versions} />
          <p className="m-0 text-caption text-secondary">
            {SITE_NAME} is a non-commercial fan project.
          </p>
        </div>
      </div>
    </footer>
  );
}
