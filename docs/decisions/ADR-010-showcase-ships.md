# ADR-010: Showcase ships: the Anvil Odin concept hero and the RSI Perseus live example

- Status: accepted (owner direction 2026-11-08)
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

The owner, on 2026-11-08: stop validating step by step and move fast ("launch and iterate"); give the site a final design polish and make it stunning; make the **Anvil Odin** the hero page every design is tested against, with its art, a rotating model the reader can manipulate, and CIG's full-colour render of the weapon ports opening and closing; use the **RSI Perseus** as the live example; "source the assets from wherever you need (with credit)". This supersedes the per-criterion workflow in CLAUDE.md section 10 for this work and resolves the hero ship question in section 12 for these two ships only (the Phase 4 hero list stays open).

The Odin is in concept (revealed in Comm-Link 21133, 24 May 2026): the game has no data for it. The Perseus is flight ready and is now the sixth ship in the bootstrap pack.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Sources | Art, render loops and story text from each ship's own Comm-Link (Odin 21133, Perseus 20738), located through the Star Citizen Wiki API's mirror of the article and downloaded from RSI. Named media URLs return 404, so files come through the article's own image proxy links and the media ids for videos. 3D models: CIG's in-game holoviewer models as FleetYards.net converted them (Odin flight holo 1.7 MB; Perseus flight holo "lite" 9.7 MB). Every file, its URL and SHA-256 recorded in `fixtures/showcase/<slug>/sources.json` | The owner authorised any source with credit. RSI first; FleetYards only for the one thing RSI does not publish as a file (the models) |
| Politeness | `scripts/media/fetch-showcase.ts`: one request at a time, 5 s apart to RSI, 2.5 s to others, no cookies or session; files already fetched are skipped | CLAUDE.md section 9; RSI's terms ban scrapers with the sanction on the account |
| Storage | Originals in `fixtures/showcase/` (git-ignored, 138 MB); web copies (WebP at 2560/1600/960/640, videos and models as is) in `apps/web/public/media/showcase/`, git-ignored, listed in the media manifest (`Showcase` in `packages/schema/media.ts`) by `scripts/media/prepare.ts`. The Odin's published figures are committed in `fixtures/ship-matrix/ConceptShip.json` (`ConceptShip` in `packages/schema/concept.ts`, written by `scripts/media/snapshot-matrix.ts`) so its page exists everywhere | No CIG image or model enters git (ADR-009); the page degrades to text and figures without media |
| Story | The article's chapters, parsed by `scripts/media/article.ts`: heading, kicker and paragraphs verbatim, headings in sentence case, each paired with the image or render loop the article sets beside it (`scripts/media/showcase.ts`, `layout`). The opening chapter becomes the hero's tagline and lead | Storytelling in CIG's words, never written by us |
| Concept ships | `/ships/odin` is a concept page: RSI ship-matrix figures labelled as such, "Concept" badge, no stats, loadout or channels, to scale against every ship on record. Concept ships appear under "In concept" on the ships index, outside the filters | The never-invent rule: a concept ship has no game data |
| Hero | Full viewport: key art behind, the transparent ship cut-out layered over it breaking out of the frame (as CIG composes it), the name in a new `marquee` type size (144/136, 500; `hero` on phones) with tight tracking, the art fading into the page colour at the bottom so text reads on it. One entrance animation for the cut-out, off with reduced motion | The owner asked for stunning. Supersedes system.md's "gradient hero banners" anti-reference and ADR-009's "no overlay" for showcase heroes only: the fade is into the page, not a tint over the ship |
| Render loops | `AutoVideo`: muted, looping, fetched only on approach, playing only while 40% visible, never autoplaying with reduced motion | Motion is content here; it costs nothing until seen |
| 3D | `ModelStage` with Google's model-viewer 4.0 (lazy-loaded on approach): orbit, zoom, auto-spin until the reader drags, Spin and Reset controls, a gunmetal finish over the models' grey clay, the length to scale in the caption. The Draco decoder is served from `/media/draco/` (copied from three by the prepare script) so the page makes no third-party request | The rotating model the owner asked for, without trackers. A glowing hologram look was not used: CLAUDE.md section 2 rules out neon-on-black |
| Home | Opens on the Odin spotlight (key art, cut-out, marquee name, "Explore the Odin"), then the Perseus as the live feature, then search, every ship as an image card, and the feed. Dark | The site leads with its showcase |
| Type | `marquee` joins the type tokens; a showcase page uses four sizes besides ui and caption | Recorded here as CLAUDE.md section 7 requires |

## Credits on the page

Under every showcase: "Art, render loops and story: Roberts Space Industries, Comm-Link …, published …, text quoted verbatim" with a link, and "3D model: CIG's in-game holoviewer model, converted by FleetYards.net" with a link. The hero carries "Art: Roberts Space Industries" linked to the article. The footer's fan-site disclaimer, trademark line and Fankit Agreement notice stay on every page.

## Not decided (the owner's)

- Publishing any of this on a public site (cig-approval.md: RSI website images, game-extracted models) — local only until then.
- Asking FleetYards before redistributing their converted models publicly.
- Compressing the Perseus model further (9.7 MB) or loading it on demand rather than on approach.

## Consequences

- The bootstrap pack holds six ships (the "five ships" rule is now "at least five").
- `@google/model-viewer` 4.0.0 is a web dependency (three 0.169 comes with it).
- Showcase pages are long (the Odin about 19,000 px at 1280) and media-heavy; Lighthouse budgets apply to them once media is public.
