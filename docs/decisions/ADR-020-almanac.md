# ADR-020: The almanac: paper and ink, serif faces, plates and ledgers

- Status: accepted
- Date: 2026-11-09
- Deciders: owner ("I love that almanac style"; chose it over the dark observation deck; asked for it "slightly less editorial, better spacing and margins, graphical with images and holomodels"; then "I love this version, build it", 2026-11-09), Claude Code session 2026-11-09

## Context

After the design lift (ADR-019) the owner asked for mockups of a radical redesign. Two were made as local pages (not in git): option 1, a dark, full-bleed, cinematic "observation deck", and option 2, "the almanac", paper and ink, with pictures as captioned plates and numbers in ruled tables. The owner chose the almanac, then an illustrated revision of it: wider pages, a tighter rhythm, fewer editorial flourishes, more plates, and the holomodel drawn in ink. This ADR records the system that revision implies; the pages follow in their own PRs (front page and register, the ship entry, the ledger, honours, parts and dispatches).

The design principle stands: imagery carries the mood and the chrome stays quiet. What changes is the paper the chrome is printed on.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Palette | Paper by day, ink on slate by night (system.md section 2 has the values). Light: warm paper `#F4EFE5`, ink `#1C1A16`, oxblood accent `#A8321F`. Dark: slate `#1D1B17`, cream ink `#EFE9DC`, the accent lifted to `#E6735F`. Every text token reads at 4.5:1 or more on every background token in both modes (the lowest pair is 4.52:1, `text.muted` on `bg.inset`, light). The accent tint `accent.bg` carries only primary and secondary text (muted text and the accent itself fall short on it); the unit test checks both rules | Both modes stay first-class (principle 3): the dark mode is designed, not inverted. One accent, warm now |
| Faces | Newsreader for text and interface (the `sans` slot keeps its name so every `font-sans` stays valid), Fraunces for display (the `hero`, `display`, `title` and `heading` sizes and `.font-display`, set at -0.02 em; a heading at a smaller size, such as a table's, keeps the text face), IBM Plex Mono for numbers. Loaded with `next/font/google`, self-hosted at build; the `geist` package stays only for the Open Graph placeholder until that is redrawn | The almanac is typography; two serif faces and a mono are its voice. Replaces ADR-005's pair; the weights stay 400 and 500 |
| Labels | A `label` type size (11 / 16) and the `.lab` rule the token build emits from it: the mono as letter-spaced capitals, for running heads, column heads and eyebrows. The one exception to sentence case, recorded in system.md | How a register and a ledger label their columns |
| Frames | Radius 2 px everywhere; plates and panels take `border.strong` as a frame and sit on `bg.inset` as a mount. No elevation but the popover shadow, now warm | Square, printed frames |
| Width | Content max 1400 px (was 1200) | The owner asked for the width to be used; the register and the entry need it |
| Shell | The running head: the site name and the sections as labels over a strong rule, the current section in the accent, the search field at the right styled as a ruled field ("Look up a ship, a part, a title…"); footer unchanged in content. The masthead keeps its label line, title and deck, loses the art band (ADR-019): in the almanac a picture is a plate with a caption, never a background | |
| Imagery | Plates: framed, captioned, credited, untoned (the mockup's toning is not carried over, since RSI's terms and the fankit guidelines forbid altering images) | ADR-009 |
| Holomodel | The entry's holoviewer and the Scale lineup draw the models in ink: a flat-shaded body with its edges inked, on the page's paper, over a ground line, slowly turning; renders Ink, Lines and Solid. The colours are read from the page's tokens at run time, so the light and dark almanacs each draw in their own ink. The ADR-012/015 exception (CIG's own holoviewer look inside the canvas) is withdrawn and CLAUDE.md section 2 says so. The mockup's scale bar is not carried over: a bar beside a perspective view measures nothing, so the caption states the length and the person beside the ship keeps the scale honest | The owner asked for holomodels in the almanac; ink on paper is the almanac's way to draw one |
| Legal footing | Unchanged: the owner's instruction to proceed as if CIG approved the imagery is recorded in ADR-019; `cig-approval.md` records written confirmations only; image and model files stay git-ignored | |

## What this PR does not do

The pages. Each follows in its own PR with its own screenshots and audit: the front page and the register (home, ships), the entry (the ship file with the ink holomodel), the ledger, the honours, the parts and the dispatches (funding, titles, components, news). Until each lands, that page wears the new tokens, faces and shell on its existing layout.

## Alternatives considered

| Option | Why not |
| --- | --- |
| The observation deck (option 1) | The owner chose the almanac |
| Keep Geist and change only the palette | The almanac's character is its type |
| A third accent for status, or brand colours | One accent; semantic colours stay for status only |
| Serve the faces from Google Fonts at runtime | A third-party request on every page; `next/font` self-hosts |

## Consequences

- `tokens.ts`: every colour, the radii, the shadow, the content width and the faces change; `tokens.css` is regenerated; the token tests read the new values from system.md; the contrast test holds.
- `next/font/google` downloads the faces at build, so a build needs the network once (the fonts are cached by Next afterwards).
- Every screenshot changes; the gallery stories too.
- ADR-005's font pair and ADR-019's art bands are superseded by this ADR. `apps/web/lib/bands.ts` is removed.
- The entry (spec 06, criterion 3): the ship page opens on the holomodel in ink beside the name, the summary and the particulars as a ruled table, with the key art as Plate I under them; the full-bleed art band with its scrim and cut-out (ADR-014) is gone, so is the sticky left column: the contents alone stay in view beside the sections, whose figures are captioned plates. The mockup's chapter cards and figure strip are not built: ADR-014 keeps every image in the section it shows, so they would repeat the sections' own plates.
- The front page and the register (spec 06, criterion 2): the home page is the almanac's front (the date, title and contents, counters, plates, the first ten entries A to Z with a link to the register so a full pack keeps it a front page, dispatches; the builds stay in the footer's patch strip, ADR-007), which supersedes ADR-011's dossier index and ADR-019's funding strip (`home-index.tsx`, `home-register.tsx` and `funding-strip.tsx` are removed; the dossier's `FileStrip` and `FramedArt` went with the entry PR, which left the ship page no use for them). The ships index is "The register of ships"; its table carries each ship's plate. `DataTable` is ruled like a register everywhere: column heads as labels over a 2 px ink rule. Fraunces loads its italic for the front page's title.
