# Design system

The product is a premium reference, not a game HUD. CIG's renders and models carry the atmosphere; the interface stays quiet and gets out of their way. References: Linear, Stripe documentation, a Porsche configurator. Anti-references: in-game MFDs, neon-on-black HUDs, gradient hero banners, manufacturer logos as wallpaper, badge-heavy gamer dashboards.

Numbered rules are the ones the design-review prompt checks by number.

## 1. Principles

1. Imagery does the mood, chrome stays quiet. Near-black and off-white surfaces, one accent, no decoration.
2. Typography-led. One grotesk for interface text, one mono for numbers. At most three sizes per page besides interface text and captions, and two weights.
3. Light and dark are both first-class and follow the system. Ship pages default to dark.
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
| `bg.page` | `#F7F7F5` | `#0C0D0F` | Page canvas |
| `bg.surface` | `#FFFFFF` | `#141619` | Cards, panels |
| `bg.raised` | `#FFFFFF` | `#1B1E22` | Popovers, command palette |
| `bg.inset` | `#EFEFEC` | `#0F1012` | Table header, code, muted wells |
| `text.primary` | `#131416` | `#F2F2F0` | Body |
| `text.secondary` | `#5C5F66` | `#A2A6AD` | Supporting |
| `text.muted` | `#696D74` | `#82868E` | Captions, placeholders |
| `border.default` | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` | Hairlines |
| `border.strong` | `rgba(0,0,0,0.20)` | `rgba(255,255,255,0.18)` | Emphasis, hover |
| `accent` | `#2560E8` | `#5B8CFF` | Links, focus, selected, primary action |
| `accent.bg` | `#E8EFFF` | `#17223D` | Accent tint |
| `success` / `warning` / `danger` | `#1A7A43` / `#9A5B00` / `#C7352B` | `#3DBA6E` / `#E0962B` / `#E5574D` | Status only |

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

Faces: Geist Sans and Geist Mono, or Inter Tight and JetBrains Mono. Pick one pair in Phase 0 and record it in an ADR. Every number uses tabular figures (`font-variant-numeric: tabular-nums`). Sentence case everywhere. No all-caps labels except unit abbreviations and the game's own acronyms (SCM, NAV, EM, IR, LIVE, PTU, EPTU).

### Space, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Nothing in between.
- Radius: 6 px controls, 10 px cards, 14 px the command palette. Nothing else.
- Elevation: none. Hairline borders only. The command palette and popovers get one shadow token, `shadow.popover: 0 8px 24px rgba(0,0,0,0.12)`.
- Max content width 1200 px; prose max 68 ch.

### Motion

- Durations: 120 ms (hover, toggle), 200 ms (panel, palette), 320 ms (viewer camera preset).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- No ambient animation, no parallax, no auto-playing turntables above the fold.

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

Proposed with the cinematic ship page concept (ADR-008):

- `ScaleLineup` — ships on record and a person drawn to scale from length and height, the page's ship in the accent.
- `RankBar` — where one ship sits among the ships on record for one stat, linear or log scale, with its rank in words.

## 4. Page templates

| Page | Layout |
| --- | --- |
| Home | Search field as the first element. Then: today's feed (news and dev posts merged, 10 items), one featured ship card; the patch strip is in the footer. No hero banner. |
| Ships index | Filter bar (manufacturer, role, size, status, kind) + card/table toggle. Cards in a 2/3/4 column grid by breakpoint, each with a Compare toggle. Table mode uses `DataTable` with a Compare column. |
| Ship page | `EntityPage`. Hero holds the viewer (hero ships) or the best fankit render (others); until then the stage leads with RSI's official image of the ship, credited, never overlaid or tinted (ADR-008, ADR-009). Key facts: role, size, crew, cargo, length, mass (manufacturer and status are in the hero). Sections: specs by channel (with PTU diff toggle), hardpoints and stock loadout, variants and paints, changed in this version, in the news, dev posts; variants and paints, and changed in this version, are left out until there is something in them (ADR-007). Related: same manufacturer, same role. |
| Component page | `EntityPage`. Key facts: type, size, grade, class, manufacturer. Sections: stats by channel, stock on (ships that carry it by default), in the news. |
| Manufacturer page | `EntityPage` with a 3 px brand rule (the `border.strong` token until the fankit supplies brand colors). Sections: lineup (cards), in the news. |
| News feed | Source filter chips, then `FeedItem` list, infinite scroll in pages of 20, RSS and JSON links in the header. Dev tracker is a tab: author filter, `DevPost` list, thread grouping. |
| Author page | `EntityPage` without a hero image: handle, role, first seen, post count; posts newest first. |

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
3. Any decoration: gradient, glow, texture, emoji, icon used as ornament?
4. Any page element the reader could lose without losing meaning?
5. Does the ship page key-facts block read in one glance at 390 px?
6. Does every table pass the phone rule (no sideways scroll)?
7. Is the disclaimer present in the footer?
8. LCP under 1.5 s on throttled 4G for this page?
