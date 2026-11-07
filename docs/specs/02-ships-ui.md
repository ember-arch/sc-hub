# Spec 02 — Ships UI

- Phase: 2 (weeks 6 to 9; overlaps Phase 1's tail)
- Machine: laptop or cloud session
- Gate: the ship page on a preview URL with LCP under 1.5 s on throttled 4G, Lighthouse performance and accessibility ≥ 90, design review passed

## Goal

The reference experience readers come for: a ship index you can filter in one tap, a ship page that answers "what is this ship and what does it carry" in one glance, component pages, a compare view, and a command palette backed by Meilisearch. All on real Phase 1 data.

## Out of scope

3D (Phase 4; the viewer slot shows the best fankit render or a pipeline thumbnail placeholder). News and dev posts on entity pages (Phase 3 adds the sections). Loadout editing.

## Acceptance criteria

- [x] **Ship index.** `/ships` lists every vehicle with filters for manufacturer, role, size class, status, and kind; filters are URL state; card and table views; table uses `DataTable` with the phone expand-row rule; results sorted by name by default and by any stat column in table mode.
- [x] **Ship page.** `/ships/[slug]` uses `EntityPage`: hero (name, manufacturer link, status badge, image or placeholder), key facts (manufacturer, role, size, crew, cargo, length, mass, status), sections: specs by channel, hardpoints and stock loadout (nested ports, each item linked), variants and paints, changed in this version (from `diff.json`), related (same manufacturer, same role). Every stat shows its unit and the version it comes from.
- [x] **PTU diff toggle.** When PTU differs from LIVE for this ship, a toggle reveals PTU values as deltas next to LIVE values, with an arrow glyph and color, never color alone.
- [x] **Component index and pages.** `/components` grouped by `ItemType` with size and manufacturer filters; `/components/[slug]` uses `EntityPage` with stats by channel and a "stock on" list of ships that carry it by default.
- [ ] **Manufacturer pages.** `/manufacturers/[slug]` with the 3 px brand rule, lineup cards, and description from fankit or localization only.
- [x] **Compare.** `/compare?ships=a,b,c,d` shows up to four ships side by side on the key-facts set and the full stats table; shareable by URL; add and remove from the ship page and the index.
- [ ] **Command palette on Meilisearch.** Typo-tolerant, grouped results (ships, components, manufacturers), under 100 ms server time for a warm query, keyboard navigable, recent entities remembered in local storage (wrapped in try/catch).
- [ ] **Slugs and redirects.** Old slugs in `slug_history` 301 to the current slug; unknown slugs 404 with a search box.
- [ ] **SEO.** Server-rendered pages, canonical URLs, per-page title and description, `sitemap.xml`, JSON-LD for ships and manufacturers, and static Open Graph images per ship (pipeline thumbnail when present, fankit render otherwise).
- [ ] **Performance.** LCP under 1.5 s and CLS under 0.1 on `/ships/[slug]` and `/ships` at throttled 4G in Lighthouse CI; images served from R2 with width-appropriate variants.
- [x] **Accessibility.** Keyboard-only run through index, ship page, compare, and palette recorded as a Playwright test; Lighthouse accessibility ≥ 90.
- [ ] **Design review.** Design-review prompt run on home, a small ship, a capital ship, a component, and compare; findings addressed; screenshots in the PR.

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
- If a stat is null for a ship, omit the row rather than showing a dash; the key-facts block collapses gracefully.
- Ticked on the bootstrap pack (ADR-006): "Ship page" renders "changed in this version" as an empty state until spec 01 defines `diff.json`; the PTU toggle, variants and paints are built and unit-tested over synthetic rows because the pack has no PTU build, variant or paint. Spec 01's "Both channels" criterion is where the toggle is seen with real differences.
