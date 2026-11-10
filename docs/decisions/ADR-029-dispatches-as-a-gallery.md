# ADR-029: Dispatches as a gallery of covers, apart from the developer posts

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("we need to delineate between news and staff posts on Spectrum. News should be displayed like a beautiful news feed, kind of like we did on the original Coppercork trading card site, with images, a gallery etc", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-027 (the feed's shape), ADR-009 (which RSI website images are copied), system.md section 4 (the news feed's row)

## Context

The feed of ADR-027 was one list: every content item newest first as a `FeedItem` (a label line, a title, an excerpt, the source link), Comm-Links and roadmap changes and, once the Spectrum module is on, developer posts between them. Nothing on it had a picture: the wiki's record of a Comm-Link is text (ADR-027), and the hub page's covers were not read.

RSI's Comm-Link hub lists each transmission with a cover (`channel_item_full.jpg` on media.robertsspaceindustries.com, in the block's background style), and it pages by `?page=N`, ten transmissions a page, so the covers of the 405 Comm-Links on record are reachable in about forty requests at the polite rate. The wiki's record also lists the pictures inside an article (`images[].rsi_url`), but those are unlabelled and the first is sometimes a staff portrait; RSI's cover is RSI's own choice of picture for the dispatch.

The owner wants two things: the news apart from what developers say on Spectrum, and the news shown as a gallery with pictures.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Two surfaces | `/news` is "Dispatches": what CIG publishes (Comm-Links, patch notes, roadmap changes, progress-tracker changes, videos). Developer posts from Spectrum appear only on `/news/dev` and the author pages. The repository exposes `dispatches` beside `news`; the RSS and JSON feeds carry dispatches; the front page's Dispatches section shows the three newest as cards. The tabs read "Dispatches" and "Developer posts" | The owner's distinction; a developer's reply in a forum thread is not a dispatch |
| Covers | `scripts/media/fetch-covers.ts` reads the hub's pages (one request every 5 s with the project User-Agent and the contact address, CLAUDE.md section 9), takes each transmission's cover by RSI's own id for the Comm-Links on record, and copies each cover once into `fixtures/rsi-media/covers/<id>.jpg` (git-ignored); `fixtures/rsi-media/cover-sources.json` (committed) records the address, the page, size, checksum and time. `prepare.ts` writes WebP copies at up to 1920, 1280, 960, 640 and 480 px wide, never upscaled, to `/media/covers/`, and lists them in the manifest under `covers`, keyed by the Comm-Link's id. The site reads them through `media().cover(externalId)` | The same path every CIG picture takes (ADR-009, ADR-024): copied by a script at the polite rate, local only, nothing chosen by eye, the pack untouched |
| Legal footing | Local only, as every RSI picture is (ADR-009, ADR-019): a clone, CI and the deployment have no covers and the cards are words alone. The "RSI website images" box in `docs/legal/cig-approval.md` now names the Comm-Link covers beside the ship-matrix images; `attribution.md` gains the row | The cover is RSI's image from RSI's website, the footing of ADR-009 |
| The page | A `Masthead`, the tabs, the source chips, then the page's dispatches as cards: the newest as a lead card, its cover beside the words from 768 px, and the rest in a grid of one, two or three columns, each card its cover at 16:9, the label line (source, time), the title, the excerpt cut to three lines and the source link; the pager and the feed links below. One credit line, "Image: Roberts Space Industries", under the cards when any cover shows (ADR-009: a card carries no credit; the bento credits once below) | A gallery in the gallery's own grammar (ADR-021): rounded cards by tone and a soft shadow, art to the card's edges, the words in their own block; no scrim and no third exception |
| The component | `DispatchCard` in `packages/ui`, with a story and screenshots like the rest of the set; `FeedItem` stays for the entity pages' "In the news" sections (spec 03) | system.md section 3: every component has light and dark stories |
| What a card does not carry | A credit, an avatar, a generated line; the alt text is empty since the card names the dispatch (as `Card` does) | ADR-009, CLAUDE.md section 2 |
| What stays | The developer posts page, the author pages, the pack, the pollers, the workflow; a cover appears after a local run of the fetch, like a new ship's picture (ADR-024) | The pictures are local |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Hotlink RSI's covers from media.robertsspaceindustries.com | Rejected in ADR-009: RSI's bandwidth through our pages, and a moved file breaks the card |
| A cover address in `ContentItem` written by the poller | A schema change, a migration and a revision of every row on record for a fact the media layer already keeps for ships; the pack holds no picture address for a ship either |
| The wiki record's first picture | Unlabelled; sometimes a portrait or a logo; RSI's cover is the one RSI chose |
| The title over the cover on a scrim | The scrim is allowed on the entry's cover and the bento's cards (ADR-021) and nowhere else; the register's cards put the words under the art, and so do these |
| An item page with the full text and the article's pictures | Republication of a Comm-Link in full is the question `cig-approval.md` keeps open; the cards link the original |

## Consequences

- `packages/schema/media.ts`: `CoverImage`; `MediaManifest` gains `covers` (default empty, so older manifests still parse). `scripts/media/sources.ts`: `coversFromHub`, `coverRenditionPath`, `COVER_WIDTHS`, `CoverSource`, tested on the committed hub sample. `scripts/media/fetch-covers.ts` is new; `prepare.ts` builds the copies.
- `.gitignore` keeps `fixtures/rsi-media/cover-sources.json`; `fixtures/rsi-media/README.md` says what the covers are and how to fetch them.
- `apps/web/lib/data.ts`: `dispatches` on the repository; `lib/media.ts`: `cover`; `app/news/page.tsx`, `app/page.tsx`, the RSS and JSON routes and `app/news/tabs.tsx` change; `packages/ui/components/dispatch-card.tsx` and its story are new.
- The news and home screenshot records change; `e2e/news.spec.ts` checks that no Spectrum item reaches the dispatches with the module on or off.
- Spec 03's "Feed UI" note, system.md's news row and `docs/legal/attribution.md` are amended.
