import type { Metadata } from "next";
import { Section, TextLink } from "ui";
import { OFFICIAL_SITE_URL, SITE_NAME } from "ui/brand";
import {
  ABOUT_STATEMENT,
  CONTACT_EMAIL,
  DISCLAIMER,
  DISCLAIMER_SOURCE,
  FANKIT_CREDIT,
  FUNDING_INSPIRATION,
  LOANER_MATRIX_CREDIT,
  PLEDGE_STORE_CREDIT,
  RSI_HOLO_CREDIT,
  RSI_IMAGE_CREDIT,
  STARBREAKER_CREDIT,
  TITLES_TEXT_CREDIT,
  TRADEMARK_LINE,
  UEX_CREDIT,
  UNP4K_CREDIT,
  WIKI_CREDIT,
} from "ui/legal";
import { Site } from "../../lib/site";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Site>
      <div className="flex max-w-prose flex-col gap-12 pt-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-title text-primary">About {SITE_NAME}</h1>
          <p className="text-body text-primary">{ABOUT_STATEMENT}</p>
          <p className="text-body text-secondary">
            {SITE_NAME} is a reference for Star Citizen: every ship, component,
            manufacturer, news item and developer post gets a page, and the
            pages link to each other. Ship and component data is shown per game
            channel and version; LIVE is canonical.
          </p>
          <p className="text-body text-secondary">
            The official site is{" "}
            <TextLink href={OFFICIAL_SITE_URL} external>
              robertsspaceindustries.com
            </TextLink>
            .
          </p>
        </div>
        <Section id="notice" title="Fan site notice">
          <p className="text-ui text-primary">{DISCLAIMER}</p>
          <p className="text-ui text-secondary">{TRADEMARK_LINE}</p>
          <p className="text-caption text-secondary">
            Notice copied verbatim from the "{DISCLAIMER_SOURCE.section}"
            section of{" "}
            <TextLink href={DISCLAIMER_SOURCE.url} external>
              CIG's Fankit and Fandom FAQ
            </TextLink>{" "}
            on {DISCLAIMER_SOURCE.copiedOn}.
          </p>
        </Section>
        <Section id="credits" title="Credits">
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui text-secondary">
            <li>
              <TextLink href={WIKI_CREDIT.url} external>
                {WIKI_CREDIT.text}
              </TextLink>
            </li>
            <li data-testid="titles-credit">
              <TextLink href={TITLES_TEXT_CREDIT.url} external>
                {TITLES_TEXT_CREDIT.text}
              </TextLink>{" "}
              That text stays under the{" "}
              <TextLink href={TITLES_TEXT_CREDIT.licenceUrl} external>
                {TITLES_TEXT_CREDIT.licence}
              </TextLink>{" "}
              licence on the <TextLink href="/titles">titles page</TextLink>.
            </li>
            <li data-testid="funding-credit">
              {FUNDING_INSPIRATION.text}{" "}
              <TextLink href={FUNDING_INSPIRATION.url} external>
                {FUNDING_INSPIRATION.linkText}
              </TextLink>
              . The <TextLink href="/funding">funding page</TextLink> reads
              RSI&apos;s counters through the Star Citizen Wiki API.
            </li>
            <li>
              <TextLink href={UEX_CREDIT.url} external>
                {UEX_CREDIT.text}
              </TextLink>{" "}
              {UEX_CREDIT.notice}
            </li>
            <li>
              <TextLink href={PLEDGE_STORE_CREDIT.url} external>
                {PLEDGE_STORE_CREDIT.text}
              </TextLink>
            </li>
            <li>
              <TextLink href={LOANER_MATRIX_CREDIT.url} external>
                {LOANER_MATRIX_CREDIT.text}
              </TextLink>
            </li>
            <li>
              <TextLink href={RSI_HOLO_CREDIT.url} external>
                {RSI_HOLO_CREDIT.text}
              </TextLink>
            </li>
            <li>
              <TextLink href={STARBREAKER_CREDIT.url} external>
                {STARBREAKER_CREDIT.text}
              </TextLink>
            </li>
            <li>
              <TextLink href={UNP4K_CREDIT.url} external>
                {UNP4K_CREDIT.text}
              </TextLink>
            </li>
            <li>
              {FANKIT_CREDIT.text} Shown under any image that comes from the
              fankit.
            </li>
            <li>
              {RSI_IMAGE_CREDIT.text}. Shown under each ship image copied from
              RSI&apos;s ship matrix, with a link to the ship&apos;s page on
              robertsspaceindustries.com.
            </li>
            <li>
              Open-source libraries are listed on the{" "}
              <TextLink href="/licenses">licenses page</TextLink>.
            </li>
          </ul>
        </Section>
        <Section id="contact" title="Corrections and takedowns">
          {CONTACT_EMAIL === null ? (
            <p className="text-ui text-secondary">
              The contact address for corrections and takedown requests is not
              yet published. It will appear here and in the footer of every
              page.
            </p>
          ) : (
            <p className="text-ui text-secondary">
              Write to{" "}
              <TextLink href={`mailto:${CONTACT_EMAIL}`} external>
                {CONTACT_EMAIL}
              </TextLink>
              . Items Cloud Imperium asks to have removed are gone from the
              site, search and CDN within 48 hours.
            </p>
          )}
        </Section>
      </div>
    </Site>
  );
}
