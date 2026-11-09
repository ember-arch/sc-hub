# Spec 06 — The almanac

- Phase: design revision, after spec 02's fixture-pack pages and before Phase 1 data lands
- Machine: laptop or cloud session
- Gate: every page below wears the almanac on a preview of `main`, light and dark, phone and desktop, with Lighthouse performance and accessibility ≥ 90 where the budgets apply

## Goal

Rebuild the site's look as an illustrated almanac (ADR-020): paper and ink, two serif faces and a mono, pictures as framed and captioned plates, numbers in ruled tables, the holomodel drawn in ink. The owner chose this over a dark cinematic option and asked for it "slightly less editorial", with the width used, and "graphical, with images, holomodels". The pages keep their data, routes and tests; only the presentation changes.

## Out of scope

- New data or new entity types; every page draws on what the fixture pack already holds.
- Toning or recolouring CIG imagery (ADR-009; plates are untoned).
- The Open Graph image redesign (ADR-020 defers it).

## Acceptance criteria

- [x] **Foundation.** Tokens (palette, radii, shadow, width, faces, the `label` size), the generated CSS, the fonts, the shell (running head, search field, footer), the masthead without art and the card frame carry ADR-020; `system.md` reads as the almanac; every page wears the new tokens on its existing layout; token, contrast and e2e tests pass.
- [x] **Front page and register.** Home opens on the date, the title and the contents, then the counters, a hero plate with side plates, the first entry cards and the dispatches; the ships index is a register table with a plate per row (larger from lg, smaller at xl where every column shows; none without media), sortable, phone rows expanding (section 7 of `CLAUDE.md`).
- [x] **Entry.** The ship file draws the holomodel in ink (a flat-shaded body with inked edges on the page's paper, slowly turning, in a framed plate with its length and a person for scale; renders Ink, Lines, Solid), beside the name and the particulars as a ruled table, the key art as a plate under them, and each section's figures as captioned plates; the Scale lineup is drawn the same way and the ADR-012/015 holoviewer look is withdrawn (the mockup's scale bar, chapter cards and figure strip are not carried over; ADR-020 says why).
- [ ] **Ledger, honours, parts and dispatches.** Funding as a ledger on graph paper with a year table of inline bars and a daily strip; titles as stamps on slate wells with the guide table and events list; components and news as the almanac's parts and dispatches.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e`.
- Screenshots at 390 px and 1280 px, light and dark, of every page the PR touches, taken with the media folder aside so they match what CI and a deployment render.
- A fresh-context audit (`KICKOFF.md`, Audit prompt) per PR; findings fixed or deferred in the PR description.

## Notes

- Imagery and models stay git-ignored and local (ADR-009, ADR-019); CI and deployments render the plates' frames and captions with no picture inside.
- Branch prefix: `spec/06-almanac/…`. The foundation shipped from `spec/03-almanac/foundation` before this spec existed.
