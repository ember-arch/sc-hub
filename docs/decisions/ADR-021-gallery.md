# ADR-021: The gallery: one smooth face, soft shapes, the art in the header, a theme switch

- Status: accepted
- Date: 2026-11-09
- Deciders: owner (feedback on the almanac, 2026-11-09: "light and dark mode toggle", "less hard lines and square/rectangle borders, more fluid/contemporary (more MoMA over almanac)", "ship pages like Odin/Perseus should have the key art/Plate I image integrated somehow into the header rather than being standalone (background or shadowbox perhaps)", "font needs to be smoother and more contemporary"; chose a local mockup with Manrope, kept outside the repository because it carries CIG's images: "Yes, build it"), Claude Code session 2026-11-09

## Context

The almanac (ADR-020) shipped in four PRs. Seeing it whole, the owner found the paper-and-ink register too hard-edged: ruled lines and square frames everywhere, serifs, no way to choose the scheme, and the ship entry's key art set apart as a plate rather than part of the page's opening. The direction is a gallery: the reference stays, the chrome softens.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Face | Manrope, one variable family, for text, display and figures; the large sizes regular and tight (-0.03 em), headings medium; tabular numerals everywhere. Replaces Newsreader, Fraunces and IBM Plex Mono | "Smoother and more contemporary"; one face reads as one voice |
| Palette | The almanac's ink and oxblood stay; surfaces lighten to a warm white wall with white cards by day and charcoal with raised cards by night (system.md section 2). Every text token clears 4.5:1 on every background in both modes; the unit test keeps it so | The warmth was liked; the frames were not |
| Shapes | Radius 10 px on controls, 20 px on cards and the palette, pills for the nav, chips, the search field and the switch. Cards and panels sit on the page by tone and a soft shadow (`shadow.soft`; `shadow.lift` for the hero card and the palette); no frames. Hairlines divide rows inside tables and lists and nothing else; the 2 px rules are gone | "Less hard lines and square borders, more fluid" |
| Labels | `.lab` is small medium text in sentence case (12 / 16), no longer capitals | The uppercase mono was the almanac's; the gallery whispers |
| Theme switch | A switch in the header on every page, the choice kept in localStorage and applied as `data-theme` on `<html>` before the first paint. Until the reader chooses, the site follows the system. No page forces a scheme any more: the ship page's dark default (ADR-012) ends; its ink holomodel reads the tokens at start and draws in either scheme | The owner asked for a toggle; a forced page would ignore it |
| The entry's header | The key art is the cover: full width, rounded, with a soft shadow, the name, status and maker over its lower part on a gradient scrim that keeps the text legible; the credit in a pill at the top right. The holomodel and the particulars follow in two rounded panels; the sections' lead figures become rounded cards. Without media the cover is omitted and the head stands alone | "Integrated into the header rather than standalone" |
| Front page | A bento of image cards (the live example large, the concept hero tall, three more below), airy counters without dividers, rounded entry cards | The mockup the owner chose |
| Motion | Unchanged: colour transitions on hover only, the holomodel's slow turn, loading states. The mockup's hover lift is not carried over | CLAUDE.md section 7 |

## What stays from the almanac

The pages' structure and copy: the front page's contents and counters, the register, the entry's particulars and nine sections, the ledger's charts, the honours' wells, the parts strip, the dispatches; the ink holomodel; every legal footing (ADR-009, ADR-019); the names of the pages.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the serifs and only soften the frames | The owner asked for a smoother face |
| Inter Tight or Plus Jakarta Sans | Offered; the owner confirmed Manrope from the mockup |
| A theme menu (system, light, dark) | A switch is one tap; the system is the default until it is used |

## Consequences

- `tokens.ts`: colours, type weights, the label size, the faces, the radii (plus `pill`) and the shadows change; `tokens.css` is regenerated; the token, contrast and gallery tests read the new values.
- The gradient scrim on the entry's cover is the one gradient on the site, for legibility over CIG's art (as ADR-014 once allowed); the review checklist says so.
- ADR-020's faces, frames, labels and plate rules are superseded by this ADR; its palette principle, pages and holomodel stand. ADR-012's dark default for ship pages ends.
- The switch is rendered off on the server and corrected on hydration, so a reader whose system is dark and who has not chosen sees the knob move once on the first paint; a cookie would avoid it, and is not worth one.
- The ink holomodel and the Scale lineup repaint when the switch is used: they re-read the tokens on the switch's event.
- Hairlines stay under section heads and between rows; everything else that was ruled is not.
- Every screenshot changes.
