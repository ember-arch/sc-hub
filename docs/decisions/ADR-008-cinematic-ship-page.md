# ADR-008: Cinematic ship page concept

- Status: proposed (a concept on its own branch for the owner to react to; not merged until the owner approves the direction)
- Date: 2026-11-07
- Deciders: owner ("Yes, build it", 2026-11-07, on the proposal below), Claude Code session 2026-11-07

## Context

Looking at the spec 02 pages, the owner said the site "feels like a slightly buffed spreadsheet": it should be visual first, cinematic, with storytelling for each ship. The design system already says imagery carries the mood and the chrome stays quiet, but the site has no imagery yet: the fankit is not downloaded (spec 00 prerequisite), there is no R2 for pipeline thumbnails, and the 3D viewer is Phase 4. The ship page also opened on a facts box and tables. The owner approved building a concept of the Gladius page that tells the ship's story with what exists today and is ready for renders when they arrive.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The stage | Ship pages open on a full-bleed stage (`PageShell` gains a `stage` slot between the header and the main column): the maker and role, the name in a new `hero` type role (80 / 84, weight 500, desktop; `display` on phone), the status and size class, CIG's own description as the opening, the compare controls, and four headline figures (length, crew, cargo, SCM speed) in `display` mono. A render takes the full width above the text when one exists; without one there is no empty box | The page leads with the ship, not a table. The type carries the stage until the fankit or pipeline renders fill it |
| The story | CIG's in-game description for the build the page shows, quoted with its source and version ("In-game description, LIVE 4.10.2-LIVE.12881860"). `scripts/bootstrap-fixtures/descriptions.ts` copies it from the game localization as the Star Citizen Wiki API serves it (`game_description.en_EN`, falling back to the ship matrix), one request per ship through the bootstrap's rate-limited client, refusing a different game version than the pack's. It lands in `fixtures/descriptions/VehicleDescription.json`, validated by the new `VehicleDescription` type in `packages/schema` and loaded optionally like the news fixture | Storytelling in CIG's words, never invented (CLAUDE.md section 2: the manufacturer description rule applied to ships). It stays beside the pack rather than in it until the owner approves the direction; then it becomes part of the data model, the pack and the database (one migration), and the Phase 1 normalizer reads it from the localization directly |
| To scale | `ScaleLineup` (packages/ui) draws every ship on record and a person (1.8 m) from one nose point on a ground line, longest at the back, each as the same generic hull glyph sized only by the ship's length and height; the page's ship is filled in the accent. A legend lists every outline with its length; a caption says the outlines show length and height, not shape | The single most visual fact the data holds: a Gladius beside a Polaris and a person. A generic glyph reads as a vessel without pretending to be the ship's silhouette |
| Where it ranks | `RankBar` (packages/ui): a hairline track from the lowest to the highest value among the ships on record, a mark for each, the page's ship in the accent with its value and rank in words ("Fastest of the 5 ships on record", "4th of 5"). SCM and NAV speed and cargo on a linear scale; hull and mass, which span three orders of magnitude, on a log scale named under the track | Turns rows of numbers into a story the reader can see at a glance, with the scale stated so distances are not misread |
| Armament | Every gun and missile in the stock loadout, counted through turrets and racks (`lib/armament.ts`), drawn as marks sized by size class on the spacing scale, with the counts written beside them | The firepower at a glance. The hardpoints' positions on the hull are not in the data (`Port.position` is empty), so a map of where they sit waits for the pipeline |
| The reference layer | The specifications by channel, the loadout panels, the port table, variants and paints and related ships follow, unchanged | Readers who want the numbers still get every one of them |
| Template | `EntityPage` accepts `hero: null` (the hero lives on the stage) and an empty facts list (the figures live on the stage) | The ship page still uses the one template; the stage is its hero |

## What this concept does not do yet

- **Imagery.** Every visual here is drawn from data. The cinematic step is the renders: the owner downloads the fankit into `fixtures/fankit/`, and later the pipeline publishes thumbnails to R2. The stage already takes an image.
- **The other pages.** The ships index as a gallery of large renders, the component and manufacturer pages, and compare follow once the direction is approved.
- **Rules still to loosen when images arrive.** A darkening gradient for legible text over a render (system.md lists "gradient hero banners" as an anti-reference) and the image ratio of a full-bleed render need their own decision.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Use store images from the wiki API or RSI's site | The fankit is the sanctioned source for a fan site, and hotlinking RSI's CDN would route someone else's bandwidth; CLAUDE.md wants assets on our own CDN |
| Real ship silhouettes in the scale drawing | No silhouette data exists; drawing them by hand would be invented game data |
| A generated summary sentence as the story ("A small light fighter for one pilot") | Copy written by the site about a CIG ship is exactly what the never-invented rule rules out; CIG's own text exists and is better |
| Rank against the ship's own size class | The bootstrap pack has one ship per class; ranking among all ships on record is honest about the sample |

## Consequences

- One new type token (`hero`), recorded in system.md's table; two new components (`ScaleLineup`, `RankBar`) in system.md section 3.
- The ship page's sections change order: stage, to scale, among the ships on record, armament, then the reference layer.
- A new optional fixture folder, `fixtures/descriptions/`, with its script and README; the site works without it.
- If approved: the description joins the data model, the scale drawing and rank bars get unit tests over the full pack, and the concept extends to the other pages.
