# ADR-045: The Launch Cork logo

- Status: accepted
- Date: 2026-11-11
- Deciders: owner (sent the designer's four logo boards, "new logo here for the site, please implement"; chose "2. Launch Cork"; told that its wide lettering is the kind of display face CLAUDE.md section 2 rules out, answered "go ahead and use # 2 the cork blasting off and wordmark as we have it in the files", 2026-11-11), Claude Code session 2026-11-11
- Amends: ADR-041 (the stopper mark it replaces; the name and the tagline stand), CLAUDE.md section 2 (the display-face rule, for the logo's own lettering), system.md sections 2 and 3

## Context

ADR-041 gave the site a small drawn mark, a cork stopper, beside the name set in Manrope. The owner then had a designer draw four logos and sent the boards as a PDF and four PNGs (each board 2400 by 1520 px: the lockup on dark, the app icon, the favicon at 48, 32 and 16 px, and the lockup on light). He chose "Launch Cork": a cork of three copper plates seen at an angle, lifting off on three flames, beside "COPPERCORK" in wide, light capitals under a short copper rule. No vector or font file came with the boards.

CLAUDE.md section 2 says never to use sci-fi display fonts anywhere in the UI, and the wordmark's wide capitals are that kind of face. The owner was told so and chose the lettering as drawn.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The artwork | Traced from the dark board's lockup at twice its size into four SVG paths (the plates, the flames, the rule, the wordmark), each colour separated by nearest colour so the edges split fairly, coordinates rounded to the board's pixel. Two files, `apps/web/public/brand/coppercork-light.svg` and `-dark.svg`, 13.5 KB each, with the board's coppers and the page's ink. The favicon, `apps/web/app/icon.svg`, is the cork alone, centred in a square, in the light coppers | The owner's art as drawn; vectors stay sharp at every size; static files are cached once instead of inlined into every page |
| The colours | Sampled from the board: on light, plates and rule `#A85E27`, flames `#C97A40`; on dark, plates and rule `#C97A40`, flames `#E9A46E`. `brand.copper` takes the plates' values and `brand.flame` is added, both in `tokens.ts` and system.md's table, for the logo and the favicon alone; a unit test keeps the files' fills equal to the tokens and finds the tokens read nowhere else. The wordmark is `text.primary`, per scheme | The board's own colours; one place for every colour (CLAUDE.md section 7) |
| The lettering | The wordmark is part of the image, not text the interface sets: no font is loaded, and the interface's text stays Manrope (ADR-021). CLAUDE.md section 2's rule on display faces now names the logo's lettering as its one exception | The owner's decision, made knowing the rule, and kept as narrow as the logo |
| In the header | `Logo` (`packages/ui/components/logo.tsx`) at 32 px high, about 153 px wide, both files in the page with the theme rules showing one (as `Mark` shows a maker's logo, ADR-009); the link around it carries "Coppercork" as visually hidden text, so its name is the site's and the images are decorative | No flash of the wrong scheme; an accessible name that is the name |
| Not changed | The name, the tagline, the User-Agent (ADR-041); the Open Graph image, which prints the name in its own face | |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Set "COPPERCORK" in Manrope beside the traced mark | Offered; the owner chose the board's lettering |
| Find a close extended web font and load it | A second face on every page for one word, and not the designer's drawing |
| The board PNG itself | Blurs at other sizes and cannot change with the scheme |
| One inline SVG coloured by CSS variables | 13 KB in every page's HTML instead of one cached file |

## Consequences

- `packages/ui/components/logo.tsx` is the lockup (`LOGO_FILES`, `LOGO_ASPECT`); the stopper's `MARK_PATH` is gone; `tokens.ts` gains `brand.flame` and changes `brand.copper`; `tokens.css` is regenerated; the logo test is rewritten.
- Every page's header changes, so every record changes; the gallery's `logo` and `page-shell` stories too.
- The trace keeps the board's slight edge softness, invisible at header and favicon sizes; a vector file from the designer, if one comes, replaces the paths without touching the code.
