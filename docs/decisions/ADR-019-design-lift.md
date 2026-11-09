# ADR-019: Design lift: mastheads with key art, the accent as structure, image-first cards

- Status: accepted
- Date: 2026-11-09
- Deciders: owner (asked for the site to be "still classy, still elegant, but more beautiful and engaging, a bit more pop", chose the bolder option with image bands, and said to assume CIG's approvals where needed, 2026-11-09), Claude Code session 2026-11-09

## Context

With the ship file (ADR-012 to ADR-016), titles (ADR-017) and funding (ADR-018) in place, the owner found the overall design "clean but still a bit boring". The ship pages open on CIG's art; every other page opened on a 28 px title and a filter row. The design system's own principle is that imagery carries the mood and the chrome stays quiet; outside the ship pages there was no imagery.

The owner chose, from three options, the bolder one: an editorial and accent-led pass on every page, plus full-bleed CIG key art behind the title of each index page. On the images' legal footing the owner said to assume CIG's approvals where needed.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Masthead | Every index page (Ships, Components, Titles, Funding, News) opens in the shell's full-bleed `stage` slot on a `Masthead` (`apps/web/app/masthead.tsx`): a mono caption eyebrow of facts separated by middle dots, the title in `display` with a 4 px accent rule under it, a one-line lede in `body`, and the page's control (compare, the measure switch) on the right. The home page keeps its dossier masthead (ADR-011) | One opening for every page, with the facts the old count lines carried now in the eyebrow |
| Art band | Behind the masthead, one fixed piece of CIG key art per page from the showcases on file (`apps/web/lib/bands.ts`: the Perseus wallpaper for Ships, Odin pieces for Components, Titles and Funding, a Perseus render for News), full-bleed, `object-cover`, under a scrim that darkens the left where the text sits and fades into the page at the bottom (`.masthead-scrim`, the one gradient ADR-014 allows for legibility over art), credited "Image: Roberts Space Industries" in the corner. Without media the masthead stands on the page colour with less padding | The same art rule as the ship file: CIG's image, never tinted or overlaid except the scrim that keeps text readable |
| Legal footing | The owner directs the site to proceed as if CIG had approved the RSI and showcase images. `docs/legal/cig-approval.md` records written confirmations only, so its boxes stay unticked until one exists; the image files stay git-ignored and out of every deploy as before (ADR-009) | The instruction is recorded here, where decisions live, not as a confirmation that was never received |
| Accent as structure | The current section in the top nav carries a 2 px accent underline on the header's edge (`.nav-current`); every masthead title a 4 px accent rule; figures in the funding strip and the component tiles turn accent on hover | One accent, used for orientation and emphasis, never as a fill behind text |
| Cards | A ship card's art runs to the card's edges (no padded frame); the name is set in `heading`; the words sit in their own padded block. Hover still turns the name accent | Image-first, as the design system asks; the card reads as a picture with a caption |
| Home | A live funding strip under the search field: pledged since 2012, citizens (with the last 30 days), raised this year with the change on the same days last year, each in `heading` mono, the whole strip a link to the funding page. Nothing without the funding fixture | Engaging and factual; the same numbers as the funding page, never a second source |
| Components | The type chips become a grid of tiles, each with its count in `heading` mono and its name, linking to its table | The page's map at a glance; the counts are the most-read fact on it |
| Funding | The total's tile is set in `display` and spans two of five columns; the rest stay in `heading` | The headline figure leads, without clipping |
| Type sizes | Per page: `display` (masthead title), `heading` (card names, section titles, figures), `body` (ledes), with `ui` and `caption` besides. The old `title` size (28) leaves the index pages | At most three sizes per page (CLAUDE.md section 7) |
| Letter-spacing | Masthead titles at -0.02 em, like the dossier names (ADR-011) | |

### Values added (CLAUDE.md section 2)

- The masthead scrim: two gradients of the page colour over the art, one bottom to top (`bg.page` at 100, 55 and 0 percent at 0, 40 and 75 percent of the height) and one left to right (90, 68 and 30 percent at 0, 60 and 100 percent of the width). Over art, the eyebrow and lede are set in `text.primary`. This is the second allowed gradient after the ship file's fade (ADR-014); system.md's anti-reference stands for gradients as decoration.
- The nav underline sits 1 px below the header's padding (`--spacing-3`), on its border.

### Deferred (from the audit of PR 12)

- The band image is each index page's largest paint; its LCP on throttled 4G cannot be measured in CI, which has no media. If it misses the 1.5 s budget on a deploy, the 1200 px rendition becomes the fallback `src`.
- Wrapped eyebrows begin a line with the separator dot.
- Component type tiles run two to a row on phones, about 700 px before the first table.
- The home page shows `hero`, `display`, `title` and `heading` besides `ui` and `caption`; the funding strip adds a `heading` block to a page that already had four sizes before this change.
- The masthead's h1 sits in the stage wrapper, which carries `id="main"` for the skip link, as on the ship file.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Dark everywhere | Offered; the owner chose the image bands instead. Pages keep following the system theme |
| Fankit wallpapers for the bands | Unlabelled, watermarked and needing the "Made by the community" logo (ADR-009); the showcases' key art is already on file and credited |
| A hover zoom on card art | Motion is for viewer transitions and loading states only (system.md principle 7) |
| Gradient fills or glow behind titles | CLAUDE.md section 2 |

## Consequences

- `PageShell`'s `stage` slot is now used by every index page; `Card` changes its padding model, so the gallery screenshots change; every page screenshot changes (nav underline).
- system.md section 4 gains the masthead in every index page's row and section 3 lists `Masthead` and the funding strip.
- CI and a deploy have no media, so they render every masthead on the page colour; the e2e suite covers both states where a page is screenshotted.
