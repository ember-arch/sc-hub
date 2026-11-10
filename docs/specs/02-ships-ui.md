# Spec 02 — Ships UI

- Phase: 2 (weeks 6 to 9; overlaps Phase 1's tail)
- Machine: laptop or cloud session
- Gate: the ship page on a preview URL with LCP under 1.5 s on throttled 4G, Lighthouse performance and accessibility ≥ 90, design review passed

## Goal

The reference experience readers come for: a ship index you can filter in one tap, a ship page that answers "what is this ship and what does it carry" in one glance, component pages, a compare view, and a command palette backed by Meilisearch. All on real Phase 1 data.

## Out of scope

3D from game-extracted models (Phase 4). Until then the ship file's holoviewer and Scale lineup draw RSI's own holoviewer models, kept local-only (owner direction, ADR-012, ADR-015). News and dev posts on entity pages (Phase 3 adds the sections). Loadout editing was out of scope until the owner asked for it on 2026-11-08 (ADR-016); it is the criterion "Loadout editor" below.

## Acceptance criteria

- [x] **Ship index.** `/ships` lists every vehicle with filters for manufacturer, role, size class, status, and kind; filters are URL state; card and table views; table uses `DataTable` with the phone expand-row rule; results sorted by name by default and by any stat column in table mode.
- [x] **Ship page.** `/ships/[slug]` is the ship file, which replaced the `EntityPage` layout for ships at the owner's direction (ADR-012, ADR-014, ADR-015): an opening band (name, manufacturer link, status badge, key art), the particulars (role, size, crew, cargo, length, mass and the rest; ADR-007), and the same numbered sections for every ship: specs by channel, hardpoints and stock loadout (nested ports, each item linked), variants (linked) and paints, changed in this version (from `diff.json`, left out until there is one), related ships (same manufacturer, same role). Every stat shows its unit and the version it comes from.
- [x] **PTU diff toggle.** When PTU differs from LIVE for this ship, a toggle reveals PTU values as deltas next to LIVE values, with an arrow glyph and color, never color alone.
- [x] **Component index and pages.** `/components` grouped by `ItemType` with size and manufacturer filters; `/components/[slug]` uses `EntityPage` with stats by channel and a "stock on" list of ships that carry it by default.
- [x] **Manufacturer pages.** `/manufacturers/[slug]` with the 3 px brand rule (in the `border.strong` token until the fankit supplies brand colors; owner decision 2026-11-07, ADR-007), lineup cards, and description from fankit or localization only.
- [x] **Compare.** `/compare?ships=a,b,c,d` shows up to four ships side by side on the key-facts set and the full stats table; shareable by URL; add and remove from the ship page and the index.
- [ ] **Command palette on Meilisearch.** Typo-tolerant, grouped results (ships, components, manufacturers, titles: ADR-017), under 100 ms server time for a warm query, keyboard navigable, recent entities remembered in local storage (wrapped in try/catch).
- [x] **Slugs and redirects.** Old slugs in `slug_history` 301 to the current slug; unknown slugs 404 with a search box.
- [x] **SEO.** Server-rendered pages, canonical URLs, per-page title and description, `sitemap.xml`, JSON-LD for ships and manufacturers, and static Open Graph images per ship (pipeline thumbnail when present, fankit render otherwise).
- [ ] **Performance.** LCP under 1.5 s and CLS under 0.1 on `/ships/[slug]` and `/ships` at throttled 4G in Lighthouse CI; images served from R2 with width-appropriate variants.
- [x] **Accessibility.** Keyboard-only run through index, ship page, compare, and palette recorded as a Playwright test; Lighthouse accessibility ≥ 90.
- [x] **Loadout editor.** (Owner direction 2026-11-08, ADR-016.) On every ship with game data, the Hardpoints and loadout section lets a reader swap each gun, missile or torpedo, shield, power plant, cooler and quantum drive for any part in the pack that fits the port by type and size, sorted by the figure parts are compared by and showing the difference from the part fitted now; the build's damage per second by type, damage per volley, missile damage, shields, power drawn against power made and quantum drive are summed beside the stock build; the build is kept in the address and can be shared; reset to stock. Every figure comes from the parts' records. The Weapons and combat section draws the armament by who fires it (pilot, each turret, missile racks), each part in profile at a length set by its size class.
- [x] **Armour and shields.** (Owner direction 2026-11-10, ADR-026.) Weapons and combat states the ship's shield strength (health, regeneration) and its armour's damage multipliers from the vehicle's record, ranks its shields beside hull and mass, and shows "The damage path": the ship's mitigation figures per kind as its record gives them, and for any ship gun on record, chosen from a picker, one shot followed through the shields (up or down), the armour, the hull and the components, each stage the shot times one record figure on CIG's published statements (ADR-026, amended); the deflection figure is shown, not applied; the caption names what is not modelled. Readers and arithmetic have fixture tests; the page has an e2e.
- [x] **Cargo grids.** (Owner direction 2026-11-10, ADR-028.) A Cargo section on every ship file states the grids of the vehicle's record (capacity, each grid's SCU and dimensions, the largest box it takes, which are open to space) and draws them in ink, each in cells of one SCU, holding boxes of one standard size chosen from a picker, as many as stand in rows by one floor division per axis; a table gives every size against every grid; the box shapes are read from the cargo item records into `fixtures/cargo/` by script and refreshed with the pack; the caption names what is not modelled. Readers and arithmetic have fixture tests; the page has an e2e.
- [x] **Ship fitting list.** (Owner direction 2026-11-10, ADR-028.) The Cargo section lists, for a ship that carries, what Pegaxsus's Ship Fitting List says fits inside it, by verdict (fits; with tricks or barely; bugged; does not fit; not tested) and by space (hangar, cargo bay or garage, cargo module), and for any ship or vehicle, what carries it; the sheet's marks and its own words for them are kept; the lines under the lists name the author, the build it was tested on, the date it was last updated and the sheet, and say it is community-tested and not game data. Copied by `scripts/fitting/fetch.ts` from the sheet's own cells and legend into `fixtures/fitting/`, refreshed daily; the author's agreement to the reuse is recorded in the fixture and asked for before launch, as with UEX. Parser, index and page have tests.
- [x] **Design review.** Design-review prompt run on home, a small ship, a capital ship, a component, and compare; findings addressed; screenshots in the PR.
- [x] **Titles.** `/titles` lists every title (the badges RSI shows beside a player's name) with its icon where one is built, grouped by how each is earned, with search, group and status as URL state, an anchor per title and a Titles group in the command palette; linked from the top nav. The catalogue is copied by script from the Star Citizen Wiki and validated (ADR-017); its text is credited under CC BY-SA 4.0 on the page and the about page; the icons are CIG's art and stay local until the owner decides to publish them.
- [x] **Funding.** `/funding` shows RSI's pledge and citizen counters since 2012 from the Star Citizen Wiki API: year bars, a month grid, this year against the last two, the trailing-year trend and the daily rate, with the measure as URL state; months and years are reported only where snapshots exist at both ends (ADR-018). Linked from the top nav; Sycend's dashboard credited for the measures.

## Suggested order

1. Meilisearch-backed palette (it unlocks navigation for everything else).
2. Ship index with filters, card then table.
3. Ship page sections in order; PTU toggle.
4. Component pages and "stock on".
5. Manufacturer pages.
6. Compare.
7. SEO, OG images, sitemap.
8. Performance pass, accessibility test, design review.

## Verification

Lighthouse CI reports attached; Playwright screenshots (390 and 1280, light and dark) for every new page; the owner opens the preview on a phone and approves in the PR.

## Notes

- The ship page is the product. Spend the design effort there first; the index and compare follow its patterns.
- If a stat is null for a ship, omit the row rather than showing a dash; the key-facts block collapses gracefully. The ship file's particulars are the exception: the same rows for every ship, saying "Not on file" or "Not stated" where a value is missing, so every file reads alike (ADR-012).
- Ticked on the bootstrap pack (ADR-006): "Ship page" leaves "changed in this version" out until spec 01 defines `diff.json` and publishes a second version (owner decision, ADR-007; the section is built then, tracked in spec 01's notes); the PTU toggle, variants and paints are built and unit-tested over synthetic rows because the pack has no PTU build, variant or paint. Spec 01's "Both channels" criterion is where the toggle is seen with real differences. "Slugs and redirects" answers an old slug with 308, the permanent redirect Next sends (same meaning as 301 for a GET; it also keeps the method); the pack's histories are empty, so the resolver is unit-tested over a synthetic renamed row. "SEO" ships a tokenized placeholder Open Graph image per ship until a pipeline thumbnail or fankit render exists, and canonical URLs resolve against `SITE_URL` (CLAUDE.md section 9). "Design review" findings were fixed where they were code and recorded for the owner where they are token or design-document decisions (ADR-006, "Design review"); the owner settled those on 2026-11-07 (ADR-007), including darker light-mode accent and status colors that pass 4.5:1.
