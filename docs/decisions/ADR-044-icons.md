# ADR-044: Icons, beside the labels where they help the eye

- Status: accepted
- Date: 2026-11-11
- Deciders: owner ("We should strategically use icons and other visual affordances all throughout the site (classy and where it adds value, not overdoing it for the sake of it) like in the armor penetration graph little shields plate armor or bullet/laser logos could be helpful here to break up a rather dense block and show the progression we are outlining", 2026-11-11), Claude Code session 2026-11-11
- Amends: ADR-021 (the gallery's visual grammar), ADR-026 (the damage path's figure), system.md sections 1, 3 and 7

## Context

The site has no icons. Its pages are text, figures and CIG's art (ADR-021), and CLAUDE.md section 2 rules out emoji, glow, scan lines and the sci-fi HUD look. The owner asked for icons where they add value, without overdoing it, and named the damage path (ADR-026) as the first place: a dense table and six stages a shot passes through, which read as one block.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The set | `Icon` in `packages/ui/components/icon.tsx`: thirteen line glyphs on a 24-unit grid, drawn by hand for this site, stroked in the text's own colour (`currentColor`) at 1.5, round caps, no fill, no colour, gradient, glow or text of their own. At 16 px beside interface text (the spacing scale's 16; 24 is there for a larger mark, unused but in the story). Names: the three damage kinds the guns deal (`physical`, a ballistic round; `energy`, a bolt; `distortion`, one wave, since two read as "≈" over figures), the stages of the damage path (`shot`, `shield`, `through`, `armour` as an upper plate overlapping a lower one, each riveted, `hull` as a ship from above, `components` as a chip, `next`), and the three axes (`pitch`, `yaw`, `roll`) | One quiet set that reads as part of the type, in either scheme; no library to add, nothing that looks like a game's HUD |
| The rule | An icon stands beside its label, never in place of it, and is hidden from assistive tech (the label is the name); at most one per label; it marks a kind, a stage or an axis the reader compares, not decoration. A new place for icons is a line in this record | "Where it adds value, not overdoing it" |
| Where, first | The damage path: each kind's glyph in the table's column heads; each mitigation row's glyph (shield, armour, hull, components), the table's glyphs from the `sm` width up, since on a phone its figures need the width; each stage of a shot with its glyph, and from `md` a chevron (`next`) between the stages so the six read as one path. The ship file's facts take an optional `icon`: "Hull" the hull, "Shield strength" the shield, "Armour" the plates, "Pitch", "Yaw" and "Roll" their axes (ADR-043); where a list has any glyph, every label gets the same slot, so the column keeps one edge, and the label stays on its value's baseline. Every glyph takes the colour of its label | The owner's example, and the defence layers and axes it names |
| Where not | The nav, the figure strip, the cards, headings | Text already does the job there; an icon would be decoration |
| Added by ADR-050 (2026-11-11) | `play` on a video card's thumbnail, the one icon on a card: it stands for the player the press opens and is hidden from assistive tech with the thumbnail's link, the title link naming the video. `close` beside "Close" in the video player. `next`, and `next` turned, alone on a row's two paging buttons (`Rail`), each named for assistive tech ("Latest videos: scroll on"): arrows on a row's ends are read as such everywhere, and a word beside each would crowd the running head | The owner asked for a row of videos that plays in place; a thumbnail without a play mark does not say it plays |

## Alternatives considered

| Option | Why not |
| --- | --- |
| An icon library (Lucide, Heroicons) | Has no ballistic round, plate armour or axes in this sense, and would bring a second visual voice; thirteen glyphs are cheaper to keep consistent |
| Coloured icons per damage kind | One accent (CLAUDE.md section 7); colour would be decoration and a second cue the label already gives |
| Icons in place of the kind labels in the table | A glyph alone is a riddle; the label stays |

## Consequences

- `packages/ui` gains `Icon` with a story, records and a unit test that every glyph is strokes in `currentColor` with no colour of its own; `Fact` gains an optional `icon`; the damage path and the ship file's Weapons and combat and Mobility facts change, and the ship records with them.
- system.md section 3 lists `Icon` and section 1 the rule; the design review's checklist asks whether each icon stands beside a label and marks something compared.
- Further places (the compare table's rows, the components index's types) are each a line here when the owner asks.
- Deferred from the audit: the unit test checks the glyphs' attributes, not their drawing, which the story records and the review do; the in-between widths (640 to 1023 px) have no record of their own.
