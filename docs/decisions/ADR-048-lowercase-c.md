# ADR-048: The wordmark's second c in lowercase

- Status: accepted
- Date: 2026-11-11
- Deciders: owner ("can you actually edit the logo to make that second C lower case?")
- Amends: ADR-047 (the wordmark); the name in text, `SITE_NAME` "Coppercork", now matches the logo

## Context

The designer's revised board draws the wordmark as "CopperCork", with a capital C starting "Cork". The site's name in text is "Coppercork". The owner asked for the second C to be lowercase. The board's lettering has no lowercase c to copy.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The letter | Built from the wordmark's own second "o". Its right side is cleared between 37.1% and 63.3% of its height, with flat horizontal cuts, the proportions measured from the board's capital C. Drawn at four times the lockup's units and traced as before | The capital C is the face's own answer to how its round letters open: flat horizontal terminals. A c made from its o with that opening keeps the weight, the curve and the x-height exactly. It is 196 units wide against the o's 200, as the cuts land where the bowl is almost at its widest, like the capital's |
| The spacing | The c starts where the capital C started (the r-to-C gap stays). "ork" moves left 46 units so the c-to-o gap equals the board's C-to-o gap of 15 units. The lockup's width drops from 2742 to 2696 | The board's own gaps, unchanged |
| Everything else | The cork, the flames, the other nine letters, the coppers and the favicon keep their traced paths byte for byte | Only the asked-for letter changes |

## Consequences

- `LOGO_ASPECT` is 2696/542; at 32 px the header logo is 159 px wide.
- `logo.test.ts` is unchanged: three paths, the favicon equal to the lockup's cork, the coppers by scheme.
- A designer's own lowercase c, if one comes, replaces the drawing without touching the code.
