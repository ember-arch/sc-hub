# Design system

The product is a premium reference, not a game HUD. CIG's renders and models carry the atmosphere; the interface stays quiet and gets out of their way. References: Linear, Stripe documentation, a Porsche configurator. Anti-references: in-game MFDs, neon-on-black HUDs, gradient hero banners, manufacturer logos as wallpaper, badge-heavy gamer dashboards.

Numbered rules are the ones the design-review prompt checks by number.

## 1. Principles

1. Imagery does the mood, chrome stays quiet. A warm white wall by day and charcoal by night, cards that sit by tone and a soft shadow (ADR-021), one accent, no decoration.
2. Typography-led. One smooth face, Manrope, for text, display and figures (ADR-021). At most three sizes per page besides interface text, captions and labels, and two weights.
3. Light and dark are both first-class. The site follows the system until the reader uses the switch in the header, whose choice is kept (ADR-021); the dark mode is designed, not inverted. No page forces its own scheme.
4. Search is the navigation. The command palette is reachable from every page.
5. Every entity page uses one template: hero, key facts, body sections, related entities.
6. Tables earn their density: fixed columns, sticky header, units in the header, sort on tap; rows expand on phone instead of the table scrolling sideways.
7. Motion is functional only.
8. Performance is a design rule: LCP under 1.5 s on throttled 4G for every non-3D page.
9. Icons are rare and quiet (ADR-044): one line set in the text's own colour, beside a label and never in place of it, marking a kind, a stage or an axis the reader compares; never decoration.

## 2. Tokens

All tokens live in `packages/ui/tokens.ts`. Tailwind config is generated from that file. These are the Phase 0 starting values; changing any of them needs an ADR.

### Color

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg.page` | `#F6F4EF` | `#161513` | Page canvas: the gallery's warm white wall by day, charcoal by night (ADR-021) |
| `bg.surface` | `#FFFFFF` | `#1F1E1B` | Cards, panels |
| `bg.raised` | `#FFFFFF` | `#262522` | Popovers, command palette |
| `bg.inset` | `#ECE9E2` | `#272622` | Pills, table header, muted wells |
| `text.primary` | `#1A1917` | `#F1EEE6` | Body: ink |
| `text.secondary` | `#5A5852` | `#B5B1A6` | Supporting |
| `text.muted` | `#67635B` | `#9B968B` | Captions, placeholders |
| `text.on-art` | `#F6F4EF` | `#F6F4EF` | Text over CIG's art, on the scrim (ADR-021) |
| `scrim` | `rgba(12,11,10,0.78)` | `rgba(12,11,10,0.78)` | The gradient under text over art (`.art-scrim`), the same in both schemes |
| `border.default` | `rgba(26,25,23,0.10)` | `rgba(241,238,230,0.10)` | Hairlines, the only dividers |
| `border.strong` | `rgba(26,25,23,0.24)` | `rgba(241,238,230,0.24)` | A firmer hairline where a table or a field needs one |
| `accent` | `#4A5AD3` | `#98A4F4` | Links, focus, selected, primary action: periwinkle, on the blue side (ADR-032) |
| `accent.bg` | `#E3E6FA` | `#2A2E4A` | Accent tint |
| `success` / `warning` / `danger` | `#2F6B3A` / `#8A5A00` / `#B3261E` | `#6FBF7F` / `#E0A94A` / `#EF7A6E` | Status only |
| `spectrum.staff` | `#DEC342` | `#DEC342` | Spectrum's own yellow for a staff post (ADR-032): the rule and the role tag on a developer post, never text on the light wall |
| `brand.copper` | `#C97A40` | `#C97A40` | The logo's copper (ADR-041, ADR-045, ADR-047): the cork's plates, the logo and the favicon alone, never text, border or fill elsewhere |
| `brand.flame` | `#B5652E` | `#E9A46E` | The logo's flames (ADR-045, ADR-047): darker than the plates on light, lighter on dark, as the board draws them. The logo and the favicon alone |

Rules: one accent. Manufacturer brand colors may appear only as a 3 px rule on the manufacturer page hero, never as fills. The logo's coppers, `brand.copper` and `brand.flame`, appear only in the logo and the favicon (ADR-041, ADR-045, ADR-047). Semantic colors are for status (flight-ready, concept, PTU-only), never decoration.

### Type

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `hero` | 80 / 84 | 400 | An entry's name, desktop (ADR-021) |
| `display` | 40 / 44 | 400 | Page and entry titles on phones; the front page's daily line from lg (ADR-042); headline figures |
| `title` | 28 / 34 | 400 | Page title; the figure strip's numbers; the front page's daily line on phones (ADR-042) |
| `heading` | 20 / 26 | 500 | Section heading, card names |
| `body` | 16 / 26 | 400 | Prose |
| `ui` | 14 / 20 | 400 / 500 | Controls, table cells, nav |
| `caption` | 12.5 / 18 | 400 | Units, metadata, timestamps |
| `label` | 12 / 16 | 500 | Small labels (`.lab`): eyebrows, column heads, the names over counters; sentence case (ADR-021) |

Faces: Manrope (ADR-021, replacing the almanac's serifs) for everything: text, interface, display and figures. The `hero`, `display` and `title` sizes are set at -0.03 em, `heading` at -0.01 em, and the large sizes regular rather than medium: the face carries them, emphasis is medium. Every number uses tabular figures (`font-variant-numeric: tabular-nums`). Sentence case everywhere, labels included. Unit abbreviations and the game's own acronyms (SCM, NAV, EM, IR, LIVE, PTU, EPTU) keep their case.

### Space, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Nothing in between.
- Radius: 10 px controls, 20 px cards, 20 px the command palette; pills (nav, chips, the search field, the theme switch) round fully, `radius.pill`. Nothing else (ADR-021).
- Elevation (ADR-021): cards and panels sit on the page by tone and a soft shadow, never a frame: `shadow.soft: 0 10px 30px rgba(26,25,23,0.08)` for cards and panels, `shadow.lift: 0 24px 64px rgba(26,25,23,0.14), 0 2px 6px rgba(26,25,23,0.06)` for the hero card and the command palette, `shadow.popover: 0 16px 48px rgba(26,25,23,0.18)` for menus. Hairlines divide rows inside tables and lists; nothing else is ruled.
- Max content width 1400 px; prose max 68 ch. One exception, the owner's (ADR-035): an opened developer post runs across its card.

### Motion

- Durations: 120 ms (hover, toggle), 200 ms (panel, palette), 320 ms (viewer camera preset).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- No ambient animation, no parallax, no auto-playing turntables above the fold.
- Exceptions (ADR-015, ADR-020): the holomodel turns slowly until the reader takes hold of it; CIG's render loops play while on screen and each carries a Pause control. All stop with reduced motion.

## 3. Components (Phase 0 set)

`packages/ui` ships these, each with light and dark stories and a Playwright screenshot:

- `PageShell` — the logo with the name as visually hidden text (ADR-045), the sections as pills (the current one filled), the search field as a pill and the theme switch (ADR-021); the footer on every page.
- `Icon` — the site's line glyphs (ADR-044): damage kinds, the damage path's stages and the three axes, at 16 or 24 px in `currentColor`, hidden beside their labels.
- `Logo` — the Coppercork logo (ADR-045, ADR-047): the owner's "Launch Cork", the cork lifting off beside the "Coppercork" wordmark (the board's second C drawn lowercase, ADR-048), two static SVG files (light and dark) swapped by the theme like a maker's mark, in the header at 32 px; the favicon is the cork alone.
- `ThemeToggle` — a switch between light and dark; the choice is kept in localStorage and applied as `data-theme` on `<html>` before the first paint, and the site follows the system until it is used (ADR-021).
- `CommandPalette` — ⌘K on desktop, persistent button on phone; results grouped by entity type; keyboard navigable; shows recent entities.
- `EntityPage` — the template: `Hero` (name, manufacturer, status badge, one image or the viewer slot), `KeyFacts` (4 to 8 label/value pairs), `Section`s, `Related`.
- `DataTable` — fixed columns, sticky header (column heads as small labels over a hairline, ADR-021), sort, unit in header, expand-row mode below a breakpoint chosen per table (with a "Sort by" select for the hidden columns).
- `Plate` — a picture in a rounded card with a soft shadow and a numbered caption ("Plate I."), the name linked, the credit as a label at the right (ADR-020, ADR-021). Three shapes: wide 2:1, panorama 16:7, card 16:9. Without a picture the card holds the caption alone.
- `StatRow` — label, value, unit, optional delta (for PTU diffs) with a muted arrow, never color-only.
- `Badge` — status only; uses semantic colors.
- `Card` — ship card: image, name, manufacturer, role, two stats.
- `FeedItem` — source chip, title, time, excerpt, linked entities as chips.
- `DispatchCard` (ADR-029) — a dispatch as a card: its cover at 16:9 to the card's edges when the local media has one, the label line (source, time), the title, the excerpt cut to three lines (four on the lead) and the source link always visible; no credit on the card, no scrim.
- `DevPost` — a developer post with Spectrum's yellow as its mark (ADR-032): a 3 px rule down the left edge and the ring of the role tag; folded by default to the thread's title, the author, the time and the first lines, opened with a tap to the whole post across the card (ADR-035); the links to the post and its thread always visible under the fold.
- `DevPostCard` (ADR-050) — a developer post as a small card for a rail: `DevPost`'s marks (the yellow rule, the role tag's ring) with the time, the thread's title, the author and four lines of the post, and the links to the post and its thread under it; it does not unfold.
- `VideoCard` (ADR-050) — a video as a card: YouTube's thumbnail at 16:9 with "Play" over it (a word, not an icon; and a "Short" label on a Short), the label line (channel, time), the title and "Watch on YouTube"; the thumbnail and the title open the page's player when it has one and are links to YouTube without it.
- `Rail` (ADR-050) — a row of cards that scrolls sideways with scroll snapping and the next card always peeking in; from `md` two buttons, "Back" and "More", page it by a jump, hidden when it fits; `phoneOnly` makes it a row below `md` and a grid above.
- `PatchStrip` — the LIVE version, and the PTU version when one is recorded (ADR-046), shown in the footer of every page, home included.
- `Footer` — disclaimer (verbatim, see legal), attribution lines, legal links.

Added by spec 02 (ADR-006):

- `FilterBar` — a GET form of labelled native selects; filters are URL state, so each change navigates to a shareable address.
- `SegmentedLinks` — a row of links that reads as one control (the card/table toggle).

Added with the design lift (ADR-019):

- `Masthead` (in `apps/web`) — every index page's opening in the shell's `stage` slot: a label line of facts, the title in the display face, a one-line deck and the page's control on the right (ADR-020, softened by ADR-021: no rule under it). The current nav section is a filled pill.
- `Counters`, `Contents`, `Bento`, `RegisterLink`, `RunningHead` (in `apps/web/app/front.tsx`) — the front page's parts (ADR-020, ADR-021, ADR-038): the headline figures as the figure strip (each a link but citizens since ADR-040; no rules), the numbered sections, the five image cards (two fixed, three drawn daily), the register link with the pack's count, and a label-sized heading with a link or a note at the right. `FundingNow` and `MonthPairs` (in `apps/web/app/funding-now.tsx`) draw this year's funding against last year's; `ViewToggle` (in `apps/web/app/view-toggle.tsx`) is the client control between server-rendered views, buttons in the segmented control's classes with `aria-pressed`.

Added with the ship file (ADR-008, ADR-012 to ADR-016):

- `ScaleLineup` — ships on record and a person drawn to scale from length and height, the page's ship in the accent; the Scale section's fallback when no models are built.
- `RankBar` — where one ship sits among the ships on record for one stat, linear or log scale, with its rank in words.
- `HoloViewer` — RSI's holoviewer model of the ship drawn in ink (ADR-020): a flat-shaded body with inked edges on the page's paper, colours read from the tokens at run time; renders Ink, Lines and Solid; seven view angles; full screen; a person for scale; a ground line.
- `HoloLineup` — the Scale section: every ship's model to scale in one canvas on one ground line, the page's ship in full ink and the others dimmer, a camera button per ship.
- `AutoVideo` — a render loop at its own proportions, playing while on screen, with a Pause control.
- `ArmamentPlan` — the armament by who fires it, each gun, missile or torpedo drawn in profile at its size class.
- `LoadoutEditor` — swap each swappable part for one that fits, with the build summed and ranked against stock (ADR-016).
- `Related` — the maker's other ships and the ships with the same role, linked.

## 4. Page templates

| Page | Layout |
| --- | --- |
| Home | The hero home page (ADR-038, on ADR-020 and ADR-021): the date as a label, the daily line (ADR-042: two clauses composed by rule from the pack, the freshest word from CIG and, by the day, the builds or the funding) as the title beside the numbered contents (from `md`; on phones the header's sections stand in for it, ADR-046), the figure strip (pledged, citizens, this year, ships and parts on record; each but citizens a link, the funding ones to the card below); "Dispatches from the Verse", the three newest dispatches as cards (ADR-029) with a link to all of them; "Latest videos" (ADR-050), the seven newest uploads of CIG's two YouTube channels as a `Rail` of `VideoCard`s, a press opening the player in place, with a link to the videos tab and the credit under it; "Featured vehicles and ships", the bento (the live example large, the concept hero tall, three ships across drawn afresh each day from those with pictures; each an image card with its name over a scrim, credited once below) and under it one link, "See all N ships and vehicles in the register"; "Featured developer posts", only with Spectrum on: a `Rail` of `DevPostCard`s, one per thread, three to five (ADR-050), the threads staff opened in the last 48 hours first (72 when fewer than five), then the threads they answered in, newest first (ADR-039), with a link to the tracker; "Funding this year", the site's one funding surface (ADR-040): three figures (the year so far, the share of last year's total, the change on the same days), a client toggle between this year against last year as running totals and each month so far beside last year's, drawn in ink on graph paper (ADR-018, ADR-020), and the sources line under it; the builds stay in the footer's patch strip (ADR-007). On a phone the dispatches and the bento are rows to swipe as well (ADR-050), one card and the next one's edge across the screen, so no section is a column of tall cards; from `md` they are the grid and the bento. Without media the bento's cards are toned panels with the names and the dispatch cards are words alone. |
| Ships index | "The register of ships": `Masthead` (ADR-020), the compare link on its right, and while the basket holds a ship a bar stuck to the foot of the screen with the count and the way to the comparison (ADR-046). Filter bar (manufacturer, role, size, status, kind) + card/table toggle. Cards in a 2/3/4 column grid by breakpoint, art to the card's edges and the name in `heading`, each with an "Add to compare" toggle. Table mode is the register: `DataTable` with each row's plate over its name in the display face (from lg; smaller at xl, where every column shows; none without media) and a Compare column. Components, Titles, Funding and News open on a `Masthead` the same way. |
| Components index | "Parts, by type" (ADR-020): `Masthead`, the filter bar (size, manufacturer), a line saying how many built-in thrusters and fuel intakes are left out with a link to list them (`?fixed=shown`, ADR-046), the type counts as a figure strip (each a jump to its table), then one ruled section per type with its `DataTable`. |
| Ship page | The ship entry (ADR-012, ADR-014, ADR-015, ADR-020, ADR-021), in the reader's scheme. The opening: the key art as the cover, full width and rounded with a soft shadow, the status, maker and role as pills and the credit pill over its top, the entry code and the name over its lower part on a scrim (a ship CIG publishes as a cut-out over a key background is composed that way, the whole ship in the band above the name); then the holomodel in ink and the particulars (a factual sentence, the ruled particulars, compare) in two rounded panels; without art the head stands on the page, without a model the particulars stand alone. Below, the contents stay in view on wide screens beside the same ten numbered sections for every ship (Brief, Acquisition and status, Weapons and combat, Crew and operations, Cargo, Mobility, Scale, Specifications, Hardpoints and loadout, Sources), each section opening on a hairline with its number as a label, its images and render loops as captioned cards, every game figure with its build, and related ships with the sources. |
| Component page | `EntityPage`. Key facts: type, size, grade, class, manufacturer. Sections: stats by channel, stock on (ships that carry it by default), in the news. |
| Manufacturer page | `EntityPage` with a 3 px brand rule (the `border.strong` token until the fankit supplies brand colors). Sections: lineup (cards), in the news. |
| News feed | "Dispatches" (ADR-020, ADR-029): `Masthead`, the tabs (Dispatches, Developer posts, Videos; ADR-050), source filter chips as labels, then what CIG publishes as `DispatchCard`s: the page's newest as the lead with its cover beside the words, the rest in a grid of one to three columns, each with its cover at 16:9, the label line (source, time), the title, the excerpt cut to three lines (four on the lead) and the source link; twenty a page with Newer and Older, RSS and JSON links below, one RSI credit under the cards when any cover shows. Without media the cards are words alone. Developer posts are their own tab: author filter, folded `DevPost` cards newest first (ADR-035), never among the dispatches. Videos are the third tab (ADR-050): `Masthead`, a chip per channel, `VideoCard`s newest first in a grid of one to four columns, twenty-four a page, the credit under them; a press opens the player in place; never among the dispatches. |
| Author page | `EntityPage` without a hero image: handle, role, first seen, post count; posts newest first. |
| Titles | "Honours and titles" (ADR-017, ADR-020): the wiki's lead and a count line with its credit; a filter form (search, group, status) as URL state; a group index (sticky rail on desktop); one ruled section per group in its own shape: stamps (the icon on a slate well, the name in the display face, the threshold as a figure), the bonus titles under their shared icon, the guide track-by-rank grid with its ranks as column heads, cards with the wiki's sentence; a Sources section last. Icons sit on a slate well (the dark almanac's paper, `data-theme="dark"`) at up to 64 px and at most twice their size; no well without an icon. |

## 5. Copy

- Sentence case for every heading, button, label, and tab.
- No exclamation marks, no "please", no "click here", no "simply".
- Units in the header of a table, not in each cell.
- Timestamps: relative under 7 days ("3 h ago"), then absolute (`12 Nov 2026`).
- Empty states name the space and the next step: "No PTU differences for this version."
- Errors say what happened and what to do, one sentence, no first person.

## 6. Accessibility

- Every interactive element reachable by keyboard; the palette is fully operable without a mouse.
- Color is never the only carrier of meaning (PTU deltas use an arrow glyph plus color).
- Contrast at least 4.5:1 for text in both modes; the token table above is chosen for that.
- The 3D viewer has a static image fallback and `prefers-reduced-motion` disables camera animation.
- Lighthouse accessibility ≥ 90 is a CI gate.

## 7. Review checklist (used by the design-review prompt)

1. Any color outside the token table? (The logo's coppers are in the table, for the logo and the favicon alone, ADR-045.)
2. Any type size or weight outside the type table? (The logo's lettering is drawn inside its two files, not a face the interface sets, ADR-045.)
3. Any decoration: gradient, glow, texture, emoji, icon used as ornament (an icon stands beside a label and marks something compared, ADR-044)? (One gradient is allowed because it keeps text legible over CIG's art, never as decoration: the scrim under text over CIG's art, on the entry's cover and the bento's cards, ADR-021.)
4. Any page element the reader could lose without losing meaning?
5. Does the ship page key-facts block read in one glance at 390 px?
6. Does every table pass the phone rule (no sideways scroll)?
7. Is the disclaimer present in the footer?
8. LCP under 1.5 s on throttled 4G for this page?
