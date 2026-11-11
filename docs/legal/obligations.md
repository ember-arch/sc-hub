# Standing obligations

These apply to every page, every deploy, forever. They are checked in CI where a check is possible and by the audit session where it is not.

## Disclaimer (every page footer)

Use CIG's own unofficial-fan-site disclaimer text, copied verbatim from the current fan-site rules on robertsspaceindustries.com at the time of Phase 0, and store it in `packages/ui/legal.ts` with the URL and date it was copied. Do not paraphrase it and do not write a version of your own. An e2e test asserts the footer contains it on home, a ship page, a component page, the news feed, and an author page.

## Non-commercial

No ads, paid tiers, affiliate links, sponsorships, or merchandise. No "support us" link unless `cig-approval.md` has the donations box ticked. The audit prompt checks for any of these in the diff.

## Trademarks and naming

- The site name, domain, logo, and social handles must not contain Star Citizen, Squadron 42, RSI, Roberts Space Industries, Spectrum, or Cloud Imperium, and must not resemble CIG's marks.
- CIG logos appear only where the fankit permits and never as the site's own identity.
- Page titles say "<entity> — <site name>", never "<entity> — Star Citizen".

## Attribution (about page and where data appears)

See `attribution.md` for the exact lines. The Star Citizen Wiki API credit appears on every page whose data came from it until the pipeline replaces that data, and stays on the about page afterwards.

## Takedown

See `takedown.md`. The contact address is published on the about page and in the footer. The per-item kill switch must work without a deploy.

## Privacy

- No accounts, no cookies beyond strictly necessary ones, no third-party trackers in v1, with one exception for the owner's confirmation: YouTube, for CIG's videos (ADR-050). The video cards' thumbnails load from YouTube's image servers on arrival, with no referrer; the privacy-enhanced player (youtube-nocookie.com), with its own cookies, storage and any advertising YouTube shows, loads only when a reader presses a video and is unloaded when they close it. The owner asked for the thumbnails and the player in place on 2026-11-11; the privacy page says what loads and when.
- Analytics is Umami, self-hosted, cookieless.
- Error tracking (Sentry) scrubs IPs and request bodies.
- A privacy page exists from Phase 0 even though it is short.

## Rate limits and identification

All fetchers send a User-Agent of the form `<site name>/<version> (+<about-page URL>; <contact email>)`, followed by the job's name as a second product token (built once, in `packages/schema/site.ts`, ADR-036; the name as the product token, `Coppercork` (ADR-041)), and respect the limits in `CLAUDE.md` section 9. The address is `SC_HUB_CONTACT_EMAIL` (`CLAUDE.md` section 9), set in CI and on Vercel; a request to robertsspaceindustries.com is refused without it, and a run on a machine without it reaches the other sources with the about page alone in the header. If a source returns 429 or asks us to stop, the worker backs off to 30 minutes and pages the owner.

## Source links

Every content item displays a visible link to its original on the source site. Dev posts link to the Spectrum post. News items link to the Comm-Link, patch note, or video. This is not optional and not collapsible.
