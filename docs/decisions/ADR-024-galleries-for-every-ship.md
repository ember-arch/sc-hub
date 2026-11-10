# ADR-024: Every ship page at the showcase standard, from the wiki's galleries

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("I want every page designed to the same standard (visually and with imagery) as the Perseus and Odin. Those are the templates for every ship page", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-010 (the showcase pair), ADR-014 (figures per section), ADR-021 (the cover)

## Context

The Odin and the Perseus are the templates: a cover of key art, a poster, a lead figure in each numbered section, a gallery, all from RSI's own art for the ship (ADR-010, ADR-014). Their art was curated by hand from each ship's Comm-Link (`scripts/media/showcase.ts`), which does not scale to the 260 other entries. RSI's store page for a ship carries a gallery and the holoviewer model, but as an app: the page's HTML holds neither. (The model's address is read from the store's listing since ADR-025; the gallery is not, since the wiki's is the complete one.)

The Star Citizen Wiki keeps, for most ships, a Gallery section with an "Official" tab of RSI's art and an "In-game" tab of screenshots, each thumbnail linking the original upload on the wiki's media host. Article pages and uploads are what the wiki's robots rules allow this project (ADR-017), at one request every five seconds, and the titles already come that way.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Source | `scripts/media/fetch-galleries.ts` reads each entry's and each concept ship's wiki article (by its display name), parses the Gallery section (`gallery.ts`, tested on a committed sample), and copies the first eight official pictures and the first four in-game ones, skipping logos, icons and files under 600 px wide. Everything stays local and git-ignored (ADR-009, ADR-019); `fixtures/galleries/sources.json` records every file's address and checksum | The wiki's uploads are the one sanctioned, structured, complete source of RSI's art per ship; twelve pictures cover a cover, a poster, seven section figures and a gallery; about 3,400 uploads for 260 ships is a few hours once at the polite rate |
| Composition | `prepare.ts` builds a showcase for every ship with a gallery and no curated one, with the same shape the Odin and Perseus use (`Showcase`): the first official picture is the cover (no cut-out), the second the poster, the next seven lead the sections in the order brief, combat, operations, mobility, hardpoints, specifications, acquisition, the rest stand in the gallery (`composeShowcase`, tested). A caption says what kind of picture it is ("Gladius, official art", "Gladius, in the game") and no more: the wiki's file titles are uploaders' shorthand, not CIG's labels, and a caption must not invent a description; the credit names the source. An edition shows its base's gallery | The page code is the showcase pair's; only the data widens. A caption invents nothing |
| Credit | A showcase built this way carries `wiki_article`; the page credits "Images: Roberts Space Industries, via the Star Citizen Wiki" and links the article | The art is CIG's (ADR-019); the wiki hosted the copy, and ADR-017 credits the wiki where its work is shown |
| What stays as it was | The Odin and the Perseus keep their curated showcases and chapters; the holoviewer model for every ship is ADR-025, the lineup draws envelopes where a ship has none (ADR-015); RSI's ship-matrix picture (ADR-009) remains the register card and the cover of a ship whose article has no gallery | The templates are not changed, they are followed |
| Refresh | Not part of the daily refresh (ADR-023): the pictures are local only. A new ship's gallery waits for a local run, which is resumable and skips ships already on file | Same footing as the ship-matrix pictures |

## Deferred (audit of PR 27, 2026-11-10)

- The article is found by the ship's display name and nothing checks the page is about that ship; the wiki redirects a renamed article, and the record keeps the requested address. A heading check is the fix if a wrong gallery ever shows; none has.
- A `no-article` or `no-gallery` row is never fetched again, so a transient 404 or a markup change is permanent until the row is removed by hand; a re-check age is the fix.
- A Gallery section without the tabber markup yields an empty gallery, recorded as `no-gallery`, not a halt.
- The wiki cover's alt text says "key art" whatever the first official upload is.
- The ship file's source list has no entry for the article; the band's credit is the only one.
- The fetch sends the titles' User-Agent name; the two shape errors and the edition fallback have no test.

## Consequences

- `fixtures/galleries/` joins the git-ignored media folders, with its README, `sources.json` and the parser's sample committed; `.gitignore` says so.
- The media manifest's `showcase` holds an entry per ship with a gallery (some 260) beside the two curated ones; `Showcase` gains `wiki_article`.
- A ship whose article the wiki does not have under its display name, or whose article has no gallery, is recorded as such and keeps its single ship-matrix picture.
- The other half of the templates, the holoviewer model for every ship, is ADR-025.
