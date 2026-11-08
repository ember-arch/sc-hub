# ADR-012: The ship file: one template for every ship, two columns, and a hologram viewer

- Status: accepted (owner direction 2026-11-08); supersedes the ship-page parts of ADR-008, ADR-010 and ADR-011
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

On the dossier pages (ADR-011) the owner asked for: the holographic look of RSI's own holoviewer with its effects; a two-column page instead of one long column; no copying of RSI's sales language; every ship page with exactly the same formatting, sections and construction; and content for a captain or org deciding on acquisition, professions and battle plans rather than a sales brochure. All images and render loops stay.

## Decision

| Concern | Choice |
| --- | --- |
| One template | Every ship page, concept or flying, is a ship file with the same ten numbered sections in the same order: Brief, Acquisition and status, Crew and operations, Combat, Mobility, Scale, Imagery, Specifications, Hardpoints and loadout, Sources (`SHIP_FILE_SECTIONS` in `ship-file.tsx`). A section with nothing on record says so ("Not in the game data yet") rather than disappearing. An e2e test asserts the Gladius, the Perseus and the Odin carry the same section titles in the same order |
| Two columns | Left (5 of 12, sticky on wide screens): file strip, maker, name, the holoviewer model (or the official image where no model exists), the particulars (the same ten rows for every ship: length, beam, height, mass, crew, cargo, SCM and NAV speed, hull, size, with "Not on file" or "Not stated" where missing), compare controls and contents. Right (7 of 12): the ten sections |
| Our own words | The Brief is composed from the data (size, role, maker, status, dimensions, crew, cargo, rank among the ships on record, stock armament); the in-game description is quoted below it as CIG's text. Acquisition lists status, the build it entered the game, reveal date, variants, paints, and states that shops and prices are not in our data yet. Crew and operations, Combat and Mobility are facts derived from the stock loadout and stats (turrets, utility, guns and missiles by size, shields, countermeasures, hull, speeds, quantum drive, with rank bars). RSI's article prose no longer appears on ship pages |
| CIG's stated claims | Where the game has no data (the Odin is a concept), CIG's claims are listed per section as neutral facts, labelled "Stated by CIG, not in the game data" and cited to the source list. They live in `fixtures/ship-claims/ShipClaim.json`, written by `scripts/media/claims.ts`, which keeps a verbatim quote for each claim and refuses to write one whose quote is not in the article |
| Imagery | Every image and render loop on file, as numbered figures (render loops first), captioned with CIG's short labels in sentence case |
| Hologram | `HoloViewer` (three.js 0.169, loaded lazily) draws CIG's holoviewer model as a hologram: translucent cyan, bright at the silhouette, scan bands and a slow sweep moving up the hull, a slight flicker, faint edge lines on lighter meshes, and a projector ring. The glow scales with mesh density so dense models stay cyan rather than white. A Solid mode shows a lit gunmetal render. Drag, zoom, spin, reset; no motion with reduced motion; rendering pauses off screen; Draco decoder from `/media/draco/`. model-viewer is removed. The model geometry is the same CIG holoviewer model RSI's site uses (via FleetYards' conversion); only the drawing is ours |
| Rule exception | CLAUDE.md section 2 bans glow and scanlines in the interface. The owner chose the holoviewer look; the exception is written into CLAUDE.md and limited to the inside of the 3D canvas. The hologram cyan (`#5DD4FF`-ish, `HOLO` in `holo-viewer.tsx`) is a viewer colour, not an interface token |

## Consequences

- `concept-page.tsx`, `live-dossier.tsx`, `ship-stage.tsx`, `model-stage.tsx` and `exhibits.tsx` are gone; `file-builders.tsx` builds a `ShipFileProps` for a pack ship or a concept ship, and `ship-file.tsx` renders it.
- Section ids on ship pages are now `brief`, `acquisition`, `operations`, `combat`, `mobility`, `scale`, `imagery`, `specifications`, `hardpoints`, `sources`.
- Shops and prices, pledge or in-game, are a named gap the data does not fill yet.
