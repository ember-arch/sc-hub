# ADR-017: Titles: the entity, where it comes from, and the page

- Status: accepted
- Date: 2026-11-08
- Deciders: owner (asked for the page; on 2026-11-08 answered "Yes, local-only" for the icons and "Wiki text, credited" for the text), Claude Code session 2026-11-08

## Context

The owner asked for "a beautiful designed page with all the titles in star citizen", with each title's image, "displayed much more beautifully" than the Star Citizen Wiki's [Titles](https://starcitizen.tools/Titles) article.

A title (RSI also calls them badges) is a label with an icon that RSI shows beside a player's name on Spectrum, the forums and the citizen dossier. Titles are an RSI website feature, not game data: they are not in `Data.p4k`, they have no `class_name`, and the Phase 1 pipeline will never produce them.

What the sources offer, read on 2026-11-08:

- **The wiki article** (starcitizen.tools, revision 392946 of 22 Sep 2026) lists 197 titles in ten sections: backer (by pledge total, with the original packages), recruitment (by recruits, with the reward; plus eight "bonus" titles from referral bonus periods, all sharing one icon), guide (a grid of eleven tracks by six ranks, by successful sessions; plus three 2950 "flame" titles), minigame, Arena Commander, Persistent Universe, website event and other titles (each with "Earnable?" ✔️/❌/? and an "earned by" sentence), and unique and official titles (with who holds them). 191 distinct icon files.
- **The wiki's robots.txt** disallows `/api.php` and every `?action=` URL for all user agents, and sets `crawl-delay: 5`. Article pages, `File:` pages and the media host are allowed. Three API calls were made during research before robots.txt was read (the page's wikitext, file details for four icons, site details); nothing built here uses the API.
- **The Star Citizen Wiki API** (api.star-citizen.wiki) has no titles or badges endpoint.
- **RSI** publishes no list of titles or their icons. The icons appear only beside players' names, so getting them from RSI would mean Spectrum's internal API or reading strangers' citizen dossiers: ADR-009 rules out internal APIs (the scraping clause), and the dossier route is also a privacy problem.
- **Licences.** The wiki's text is CC BY-SA 4.0 (its site details). Its title icons are labelled "Cloud Imperium IP" (`{{RSIlicense}}`, author CIG or RSI) on the four file pages checked: CIG's art hosted by the wiki, not the wiki's own work and not under its text licence.
- **Icon sizes.** Originals run from 20 px (the three flames) to 5669 px; most are 48 to 224 px square, 61 px being the most common.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Entity | `Title` and `TitleCatalog` in `packages/schema/entities/title.ts`, outside the data pack and the registry, like `VehicleDescription` (ADR-008). One file, `fixtures/titles/Titles.json`, holds the source and licence, the article's opening paragraphs, each group's heading and paragraphs, and every title | Not game data, so not pipeline output; Zod still guards the boundary (CLAUDE.md section 6) |
| Identity | A slug made once from the group and the name (guide titles: track and rank), for example `backer-colonel`, `recruitment-colonel`, `guide-mining-escort`. It is the title's anchor on the page and its key in search | There is no game id. The same name can appear in two groups ("Colonel"), and guide titles share rank names across tracks |
| Fields | Name, group, earnable (yes, no, unknown, or null where the question does not apply), a typed requirement (pledge total in US dollars, recruits, recruitment period, or guide track, rank and sessions), the wiki's "earned by" sentence, the recruitment reward, the backer packages, the wiki's footnote links, and the icon's wiki file name, address and size | Everything the article's columns say, as plain facts or verbatim text; nothing inferred |
| Earnable for whole groups | The backer, recruitment and guide tables have no "Earnable?" column; the article says it once per section ("All backer titles can still be earned.", "All recruitment titles except for "bonus" titles…", "All guide titles except for the flames…"). The parser compares each of those three paragraphs word for word with `GROUP_INTROS` and stops on any change, an added sentence included; a special guide title that is not a flame, or a guide grid with other than six ranks, also stops it | The rule is the wiki's, not ours, and a person re-reads it whenever the wiki touches it (audit finding: a sentence check alone let "Civilian can no longer be earned" through) |
| Source and fetching | `scripts/titles/fetch.ts` makes one request for the rendered article with the project User-Agent; `scripts/titles/polite.ts` spaces every request at least 5 seconds apart, retries included. CLAUDE.md section 9 gains a row for starcitizen.tools | robots.txt rules out the API and `?action=raw`; the article page is allowed. The crawl delay is the polite limit |
| Parsing | `scripts/titles/parse.ts` reads the article's HTML with a small strict reader (`scripts/titles/html.ts`): the ten section ids, the seven table headers and every cell shape are listed, text cells may hold only links, bold, italics, breaks, paragraphs and plain spans (no `style`), and anything else throws `TitlesShapeError`, so nothing is written (CLAUDE.md section 5). The fetch also stops if a slug in the committed catalogue would disappear (a rename on the wiki), unless `TITLES_ACCEPT_REMOVED` lists exactly those slugs. No HTML library | The repo has none, and adding one now would change the lockfile that PR 9 is also changing. MediaWiki's output is machine-generated and regular; the reader refuses what it does not know rather than guessing |
| Text | The wiki's sentences (lead, section paragraphs, "earned by", reward blurbs) are kept verbatim as runs: links out to other sites keep their address, links to other wiki pages become plain text, footnote markers become a per-title list of sources. Credited on the titles page (a line under the lead and a Sources section naming the article, the revision, its contributors, the licence and the changes) and on the about page; the strings are `TITLES_TEXT_CREDIT` in `packages/ui/legal.ts`. **That text stays under CC BY-SA 4.0**; the share-alike applies to it, not to the site's code or its other content | The owner's choice, "Wiki text, credited" (2026-11-08). CC BY-SA asks for credit, a licence link, a note of changes, and the same licence for the adapted text. Names and numbers are plain facts |
| Icons | `scripts/titles/fetch-icons.ts` copies each original once from media.starcitizen.tools, one every 5 seconds, into `fixtures/titles-media/` (git-ignored); `sources.json` (file, address, file page, size, SHA-256, time) and a README are committed. `prepareTitleIcons` (`scripts/titles/prepare-icons.ts`, called by `scripts/media/prepare.ts`) writes WebP copies at 64 and 128 px, never larger than the original, to `apps/web/public/media/titles/` (git-ignored) and lists them under `titles` in the media manifest. A clone, CI and every deploy have none | The owner's choice, "Yes, local-only" (2026-11-08), the same footing as the RSI ship images (ADR-009). Publishing them is an open owner decision in `docs/legal/cig-approval.md` |
| Page | `/titles`, in the top nav between Components and News. The wiki's lead, a count line with the credit, then a filter form whose fields are URL state: `q` (search over name, track, the wiki's sentences, rewards and packages; after typing stops for 350 ms it replaces the address rather than adding a history entry per pause, and keeps whatever is typed while the page loads), `group` and `status`. A group index (a sticky rail on desktop, a wrapped row on phone), then one section per group in the shape that suits it: ladders as tiles with the threshold as a tabular figure (backer, recruitment), the bonus titles as rows under their one shared icon, the guide titles as a track-by-rank grid (seven columns on desktop, three to a row on phone), and cards with the wiki's sentence for the rest. Status shows once per section when every title in it shares one, otherwise per card. Every title has an anchor; the command palette gains a Titles group linking to them | Visual-first where there are icons, readable where there are none; the article's own shapes (ladders, a grid, event lists) carry meaning a single table hides |
| Icon display | Icons sit on a quiet inset well, drawn at up to 64 CSS px (48 in the guide grid) and never more than twice their original size, inside `<picture>` with no alt text (the name is beside them). A title without a built icon has no well at all | The originals are small; doubling is the most they take before blurring. ADR-006: an empty box is chrome the reader could lose. ADR-009: no preload hint from link prefetching |
| Folders | `scripts/titles/`, `fixtures/titles/` and `fixtures/titles-media/` are new (CLAUDE.md section 4) | |

## Not decided (the owner's)

- **Publishing the icons.** They stay local until the owner decides and ticks the "Title icons" box in `docs/legal/cig-approval.md`. Until then the public page shows titles without icons, credited text and all.
- **Keeping the catalogue current.** The fetch script is run by hand; the wiki adds a few titles a year. No scheduled job.
- **A page per title.** Titles are anchors on one page. If they become entities with their own pages (Wowhead style), the slugs are already stable.

## Deferred (from the audit of PR 10)

- **A kill switch per title.** Unique titles name their holders by handle, as the wiki and RSI do. Removing one today means editing the catalogue and deploying; a per-title takedown flag (CLAUDE.md section 5) arrives if titles move into the database.
- **Reports.** A shape error is a JSON report on stderr, like the bootstrap scripts; `pipeline/reports/` is for the patch-day pipeline.
- **Search payload.** About 197 palette entries (about 21 KB raw, 3 KB compressed) ride on every page until the palette moves to Meilisearch, whose criterion in spec 02 now lists titles.
- **Links to other wiki pages** become plain text; linking them to starcitizen.tools could come later.
- **Serving icons publicly.** If the owner publishes them, they go to the CDN (R2), never `public/` on the app server (CLAUDE.md section 2).
- **Phone header tab order.** On phones the nav row sits below the search button but comes before it in tab order.

## Alternatives considered

| Option | Why not |
| --- | --- |
| The wiki's MediaWiki API or `?action=raw` wikitext | Cleaner to read, but robots.txt disallows both |
| Icons from RSI (Spectrum's API, citizen dossiers) | Internal APIs are the scraping RSI's terms forbid (ADR-009); dossiers are other people's pages |
| Hotlinking the wiki's thumbnails | Their bandwidth on every view, and the page breaks when a file moves |
| Writing our own "how it's earned" text | Hand-entered data (CLAUDE.md section 2) and slower to keep right than the wiki's |
| Facts only, without the wiki's sentences | Offered to the owner; the sentences are most of what a reader wants to know |
| One table like the wiki's | Hides the ladders and the guide grid, and puts 48 px icons in a column |
| An HTML parsing library | See "Parsing" |

## Consequences

- Schema additions: `Title`, `TitleCatalog`, `TitleGroup`, `WikiText`, `TitleIcon`, `TitleIconMedia`, `TitleIconManifest`.
- The palette's entity types gain `title`; the nav gains Titles, so every page's screenshot changes. With four sections the nav no longer fits beside the site name and search at 390 px (the name wrapped), so on phones `PageShell` puts the nav on its own row under them; from the `md` breakpoint up the header is unchanged.
- `docs/legal/attribution.md` gains the wiki text and title icon rows; `cig-approval.md` gains the "Title icons" box; CLAUDE.md section 9 gains the starcitizen.tools limit; spec 02 gains a "Titles" criterion; system.md section 4 gains the page's layout.
- Unit tests run the parser on a copy of the article committed in `fixtures/titles/samples/` (the skin removed, every table row kept; CC BY-SA, credited in its README) and check that it reproduces the committed catalogue exactly, so a hand edit anywhere fails; fifteen cases check that it stops on shapes it does not know. E2e tests cover URL state, typing while a search loads, history, anchors, the palette, the phone width and the page without icons.
