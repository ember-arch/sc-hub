# ADR-047: The revised Launch Cork logo

- Status: accepted
- Date: 2026-11-11
- Deciders: owner (sent the designer's revised boards under the same names, "also updated logo/wordmark - please swap")
- Amends: ADR-045 (the artwork and the coppers; the two-file approach, the favicon and the CLAUDE.md section 2 exception stand)

## Context

ADR-045 traced the designer's first "Launch Cork" board: the cork lifting off beside wide capitals under a copper rule. The owner then sent a revision of all four boards as a PDF and four PNGs. On the Launch Cork board the mark is the same drawing, but:

- the wordmark is redrawn as "CopperCork" in a rounded sans, with no rule above it;
- the panels say how to use it: "On dark · white wordmark", "On light · black wordmark";
- the coppers changed. The plates are one copper on both grounds (`#C97A40`). The flames are darker than the plates on light (`#B5652E`) and lighter on dark (`#E9A46E`).

The board's large hero shows a two-tone version, with "Copper" in cream and "Cork" in copper. The usage panels show one colour per ground.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The artwork | Traced from the board's hero lockup, the largest drawing of it, at twice its size into three paths: the plates, the flames, the wordmark. The method is ADR-045's: nearest colour, potrace, integer coordinates. The lossless PNG is the source, not the PDF, whose boards are JPEG | The same method gives the same quality, and the hero has the most pixels per stroke |
| The wordmark's colour | One colour per scheme, the page's ink (`text.primary`), as the board's usage panels specify. The two-tone hero is not used | The panels are the designer's instruction for use; one ink matches ADR-045 and reads at 32 px |
| The coppers | `brand.copper` becomes `#C97A40` in both schemes; `brand.flame` becomes `#B5652E` on light and stays `#E9A46E` on dark. Both are still the logo's and the favicon's alone | Sampled from the revised board |
| The favicon | The lockup's own cork paths, centred in a square, as before, in the new coppers | Unchanged approach |
| The name in text | Unchanged: `SITE_NAME` stays "Coppercork". The drawn wordmark reads "CopperCork" | Changing how the name is spelled in titles, the header's text and the User-Agent is the owner's call, asked separately |

## Consequences

- At 32 px the new wordmark reads cleanly. ADR-045's note that the old capitals were about 8 px and grey on light no longer applies.
- `logo.test.ts` pins the new coppers and three paths, and still checks that the favicon is the lockup's cork and that no component uses the brand tokens.
- CLAUDE.md section 2's exception still covers the drawn lettering. The new lettering is a plain sans, so it no longer needs the exception, but keeping the sentence costs nothing and covers a later revision.
