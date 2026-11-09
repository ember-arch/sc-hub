# Design system

The product is a premium reference, not a game HUD. CIG's renders and models carry the atmosphere; the interface stays quiet and gets out of their way. References: Linear, Stripe documentation, a Porsche configurator. Anti-references: in-game MFDs, neon-on-black HUDs, gradient hero banners, manufacturer logos as wallpaper, badge-heavy gamer dashboards.

Numbered rules are the ones the design-review prompt checks by number.

## 1. Principles

1. Imagery does the mood, chrome stays quiet. Paper and ink surfaces (warm paper by day, ink on slate by night, ADR-020), one accent, no decoration.
2. Typography-led. A serif text face, a serif display face and one mono for numbers (ADR-020). At most three sizes per page besides interface text, captions and labels, and two weights.
3. Light and dark are both first-class and follow the system; the dark mode is designed as ink on slate, not inverted. Ship pages default to dark.
4. Search is the navigation. The command palette is reachable from every page.
5. Every entity page uses one template: hero, key facts, body sections, related entities.
6. Tables earn their density: fixed columns, sticky header, units in the header, sort on tap; rows expand on phone instead of the table scrolling sideways.
7. Motion is functional only.
8. Performance is a design rule: LCP under 1.5 s on throttled 4G for every non-3D page.

## 2. Tokens

All tokens live in `packages/ui/tokens.ts`. Tailwind config is generated from that file. These are the Phase 0 starting values; changing any of them needs an ADR.

### Color

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg.page` | `#F4EFE5` | `#1D1B17` | Page canvas: paper by day, slate by night (ADR-020) |
| `bg.surface` | `#FBF8F1` | `#24221D` | Cards, panels |
| `bg.raised` | `#FFFDF8` | `#2B2924` | Popovers, command palette |
| `bg.inset` | `#EBE4D6` | `#17150F` | Table header, code, muted wells, plate mounts |
| `text.primary` | `#1C1A16` | `#EFE9DC` | Body: ink |
| `text.secondary` | `#57534A` | `#B8B0A0` | Supporting |
| `text.muted` | `#6B665B` | `#9A927F` | Captions, placeholders |
| `border.default` | `rgba(28,26,22,0.16)` | `rgba(239,233,220,0.16)` | Hairlines |
| `border.strong` | `rgba(28,26,22,0.42)` | `rgba(239,233,220,0.40)` | Rules, plate frames, emphasis |
| `accent` | `#A8321F` | `#E6735F` | Links, focus, selected, primary action: oxblood |
| `accent.bg` | `#F2DED7` | `#4A2A22` | Accent tint |
| `success` / `warning` / `danger` | `#2F6B3A` / `#8A5A00` / `#B3261E` | `#6FBF7F` / `#E0A94A` / `#EF7A6E` | Status only |

Rules: one accent. Manufacturer brand colors may appear only as a 3 px rule on the manufacturer page hero, never as fills. Semantic colors are for status (flight-ready, concept, PTU-only), never decoration.

### Type

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `hero` | 80 / 84 | 500 | Ship name on the full-bleed stage, desktop (ADR-008) |
| `display` | 40 / 44 | 500 | Entity name in a hero; the stage's headline figures |
| `title` | 28 / 34 | 500 | Page title |
| `heading` | 20 / 28 | 500 | Section heading |
| `body` | 16 / 26 | 400 | Prose |
| `ui` | 14 / 20 | 400 / 500 | Controls, table cells, nav |
| `caption` | 12.5 / 18 | 400 | Units, metadata, timestamps |
| `label` | 11 / 16 | 400 / 500 | The almanac's labels (`.lab`): running heads, column heads, eyebrows; the mono as letter-spaced capitals (ADR-020) |

Faces: Newsreader (ADR-020, replacing the Phase 0 pair) for text and interface, Fraunces for display (the `hero`, `display`, `title` and `heading` sizes and `.font-display`, set at -0.02 em; a heading set at a smaller size stays in the text face), IBM Plex Mono for numbers. Every number uses tabular figures (`font-variant-numeric: tabular-nums`). Sentence case everywhere, with one exception: the almanac's labels (`.lab`, the `label` size: running heads, column heads, eyebrows) are set in the mono as letter-spaced capitals. Unit abbreviations and the game's own acronyms (SCM, NAV, EM, IR, LIVE, PTU, EPTU) keep their case.

### Space, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Nothing in between.
- Radius: 2 px controls, 2 px cards, 2 px the command palette. Nothing else: frames are square, as on paper (ADR-020).
- Elevation: none. Hairline borders only; plates and panels take the strong rule as a frame. The command palette and popovers get one shadow token, `shadow.popover: 0 8px 24px rgba(28,26,22,0.14)`.
- Max content width 1400 px; prose max 68 ch.

### Motion

- Durations: 120 ms (hover, toggle), 200 ms (panel, palette), 320 ms (viewer camera preset).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- No ambient animation, no parallax, no auto-playing turntables above the fold.
- Exceptions (ADR-012, ADR-015): inside the holoviewer canvases the model materialises and scan planes sweep it once on load, and the holoviewer orbits slowly; CIG's render loops play while on screen and each carries a Pause control. All stop with reduced motion.

## 3. Components (Phase 0 set)

`packages/ui` ships these, each with light and dark stories and a Playwright screenshot:

- `PageShell` — top nav (Ships, Components, News), search button, theme follows system.
- `CommandPalette` — ⌘K on desktop, persistent button on phone; results grouped by entity type; keyboard navigable; shows recent entities.
- `EntityPage` — the template: `Hero` (name, manufacturer, status badge, one image or the viewer slot), `KeyFacts` (4 to 8 label/value pairs), `Section`s, `Related`.
- `DataTable` — fixed columns, sticky header, sort, unit in header, expand-row mode below a breakpoint chosen per table (with a "Sort by" select for the hidden columns).
- `StatRow` — label, value, unit, optional delta (for PTU diffs) with a muted arrow, never color-only.
- `Badge` — status only; uses semantic colors.
- `Card` — ship card: image, name, manufacturer, role, two stats.
- `FeedItem` — source chip, title, time, excerpt, linked entities as chips.
- `DevPost` — author, role, thread, time, body with quotes preserved, source link always visible.
- `PatchStrip` — LIVE and PTU versions, shown in the footer of every page, home included.
- `Footer` — disclaimer (verbatim, see legal), attribution lines, legal links.

Added by spec 02 (ADR-006):

- `FilterBar` — a GET form of labelled native selects; filters are URL state, so each change navigates to a shareable address.
- `SegmentedLinks` — a row of links that reads as one control (the card/table toggle).

Added with the design lift (ADR-019):

- `Masthead` (in `apps/web`) — every index page's opening in the shell's `stage` slot: a label line of facts, the title in the display face, a one-line deck and the page's control on the right, over a rule (ADR-020; the art band of ADR-019 is gone: pictures are plates). The current nav section is set in the accent and underlined.
- `FundingStrip` (in `apps/web`) — the home page's live counters from the funding snapshots, one link to the funding page.

Added with the ship file (ADR-008, ADR-012 to ADR-016):

- `ScaleLineup` — ships on record and a person drawn to scale from length and height, the page's ship in the accent; the Scale section's fallback when no models are built.
- `RankBar` — where one ship sits among the ships on record for one stat, linear or log scale, with its rank in words.
- `HoloViewer` — RSI's holoviewer model of the ship in a 3D canvas: render (Default, X-ray, Wireframe), seven view angles, full screen, a person for scale.
- `HoloLineup` — the Scale section: every ship's model to scale in one canvas, the page's ship lit, a camera button per ship.
- `AutoVideo` — a render loop at its own proportions, playing while on screen, with a Pause control.
- `ArmamentPlan` — the armament by who fires it, each gun, missile or torpedo drawn in profile at its size class.
- `LoadoutEditor` — swap each swappable part for one that fits, with the build summed and ranked against stock (ADR-016).
- `Related` — the maker's other ships and the ships with the same role, linked.

## 4. Page templates

| Page | Layout |
| --- | --- |
| Home | The file strip and search, the featured files of the concept hero and the live example (each with its key art when built), the register of every ship as a `DataTable`, then today's feed (news and dev posts merged, 10 items); the patch strip is in the footer. Follows the reader's light or dark setting. No hero banner. |
| Ships index | `Masthead` (ADR-020), the compare link on its right. Filter bar (manufacturer, role, size, status, kind) + card/table toggle. Cards in a 2/3/4 column grid by breakpoint, art to the card's edges and the name in `heading`, each with a Compare toggle. Table mode uses `DataTable` with a Compare column. Components, Titles, Funding and News open on a `Masthead` the same way. The register and plates of the almanac follow in their own PR (ADR-020). |
| Ship page | The ship file (ADR-012, ADR-014, ADR-015), dark by default. A full-bleed opening band of the ship's key art (with CIG's cut-out where it publishes one) under a scrim that keeps the name, a factual sentence and four headline figures legible; credited. Two columns below: on the left, sticky on wide screens, the holoviewer, the particulars and the contents; on the right the same nine numbered sections for every ship (Brief, Acquisition and status, Weapons and combat, Crew and operations, Mobility, Scale, Specifications, Hardpoints and loadout, Sources), each with its images and render loops, every game figure with its build, and related ships with the sources. |
| Component page | `EntityPage`. Key facts: type, size, grade, class, manufacturer. Sections: stats by channel, stock on (ships that carry it by default), in the news. |
| Manufacturer page | `EntityPage` with a 3 px brand rule (the `border.strong` token until the fankit supplies brand colors). Sections: lineup (cards), in the news. |
| News feed | Source filter chips, then `FeedItem` list, infinite scroll in pages of 20, RSS and JSON links in the header. Dev tracker is a tab: author filter, `DevPost` list, thread grouping. |
| Author page | `EntityPage` without a hero image: handle, role, first seen, post count; posts newest first. |
| Titles | The wiki's lead and a count line with its credit; a filter form (search, group, status) as URL state; a group index (sticky rail on desktop); one section per group in its own shape: ladder tiles with the threshold as a figure, the bonus titles under their shared icon, the guide track-by-rank grid, cards with the wiki's sentence; a Sources section last. Icons on an inset well at up to 64 px and at most twice their size; no well without an icon (ADR-017). |
| Funding | Four stat tiles (the total in `display` over two columns, this year with the same-days change, last 365 days with its change, last 30 days); a Pledges/Citizens segmented control as URL state; year bars with the change on the year before; a month grid shaded by one hue (the accent's tint), one block per year on phones; this year against the last two as running totals; the trailing-year trend; the daily rate since 2012; a Sources section. One accent: earlier years in ink tokens with a dash as the second cue; every mark carries a title; a table of every month sits under the grid (ADR-018). |

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

1. Any color outside the token table?
2. Any type size or weight outside the type table?
3. Any decoration: gradient, glow, texture, emoji, icon used as ornament? (Two gradients are allowed because they keep text legible over CIG's art, never as decoration: the ship file's fade, ADR-014, and the masthead scrim, ADR-019.)
4. Any page element the reader could lose without losing meaning?
5. Does the ship page key-facts block read in one glance at 390 px?
6. Does every table pass the phone rule (no sideways scroll)?
7. Is the disclaimer present in the footer?
8. LCP under 1.5 s on throttled 4G for this page?
