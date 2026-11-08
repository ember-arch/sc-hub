# ADR-014: The ship file opens on its key art, and images sit in their sections

- Status: accepted (owner direction 2026-11-08); amends ADR-012
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

The owner on the ADR-012 ship file: better, but "too far in the other direction". The first showcase pass (ADR-010) was beautiful but read like a sales page; the ship file is structured and uniform but "too spartan and not attractive", and its images were "thrown into a gallery" instead of complementing the sections. The pages should feel cinematic without being salesy or retelling RSI's concept or ship pages.

## Decision

| Concern | Choice |
| --- | --- |
| Opening band | Every ship file opens on a full-bleed band (the PageShell `stage` slot, ADR-008): the ship's key art (the showcase art, or the RSI ship-matrix image), CIG's cut-out of the ship where it publishes one, layered as CIG composes it, a fade into the page under the text, and a darker band behind the text column only. Over its lower part: the file line (file number, status), maker mark, maker and role, the name in the hero size, one factual sentence composed from the data (the brief's first sentence; the build shown as its patch number), and up to four headline figures from the particulars (length, crew, cargo, pledge). The art is credited in the band's corner. No tagline, no article text |
| Template | Nine sections instead of ten: Brief, Acquisition and status, Crew and operations, Combat, Mobility, Scale, Specifications, Hardpoints and loadout, Sources. The Imagery section is gone. The two columns stay: the left (sticky on wide screens) holds the holoviewer model, the particulars and the contents; the name moves to the band |
| Figures in sections | Each image and render loop is placed in the section it shows (`sections` in `scripts/media/showcase.ts`, written into the media manifest as `figures` by `prepare.ts`): bridge, hangars, briefing room, cargo and quarters under Crew and operations; the weapon render loops and battle art under Combat; engines or flight under Mobility; plan view and size art under Scale; the layout schematic and its key under Specifications; CIG's armament graphic under Hardpoints. The first figure leads its section across the column at its own proportions; the rest follow the section's data, two to a row, each opening full size. Figures are numbered by section (Fig. 4.1) and captioned with CIG's short labels where the article gives one, otherwise with what the image plainly shows. Schematics switch to CIG's phone layouts below 768 px |
| Nothing dropped silently | A unit test requires every image and video of a showcase ship to be placed in a section, used in a role (key art, cut-out, model poster) or listed in `unused` with its reason (logos, the Perseus label strips used as captions, exact duplicates, video posters) |
| Type | The brief's paragraphs are set in the heading size, regular weight, like an editorial lead; sections are spaced further apart |
| Ships without extra media | The pack ships without a showcase get the band from their RSI image and sections without figures; the template is the same |

## Consequences

- `MediaWall` and `mediaOf` are removed; `FramedArt` stays for the home page's featured files.
- Committed screenshots still carry no CIG images (taken with `public/media` moved aside); the band then shows the text on the page colour.
- Fetching more official art for the other pack ships would give them figures too; the config and the test are ready for it.
