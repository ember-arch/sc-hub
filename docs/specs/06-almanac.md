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
- [x] **Ledger, honours, parts and dispatches.** Funding as a ledger on graph paper (a running total in ink with gaps dashed, year bars, the month grid in ink tints, the daily rate); titles as stamps on slate wells with the guide table (the mockup's events-by-year list is not built: the data holds no year per event title); components and news as the almanac's parts and dispatches.

## The gallery revision (ADR-021)

The owner's feedback on the finished almanac: softer, more contemporary, a theme switch, the key art in the entry's header, a smoother face. Two more PRs.

- [x] **Gallery foundation.** Manrope as the one face; the lighter palette; radii 10 and 20 px and pills; cards and panels by tone and soft shadow with no frames; hairlines only between rows and under section heads; labels as small sentence-case text; the shell with pill nav, pill search and a theme switch whose choice is kept and applied before the first paint; no page forces a scheme; `system.md` reads as the gallery; token, contrast and e2e tests pass.
- [x] **Gallery pages.** The front page as a bento of image cards with airy counters; the entry's key art as a rounded cover with the name over it, the holomodel and the particulars in rounded panels, the sections' lead figures as cards; the ledger, honours, parts and dispatches softened to match.

## The hero home page (ADR-038)

The owner's direction of 2026-11-10: a front page that is current every time it is built and leads into every section.

- [x] **Hero home page.** Under the masthead and the figure strip: "Dispatches from the Verse" (the three newest, linked to the dispatches); "Featured vehicles and ships" (the bento, its three outer cards drawn afresh each day, and one link to the whole register with the pack's count; the entries A to Z are gone); "Featured developer posts" (one folded post per thread, three to five, only with Spectrum on, linked to the tracker: the threads staff opened with a post in the last 48 hours first, 72 when fewer than five, then the threads they answered in by likes where recorded and newest first otherwise, ADR-039); "Funding this year" (the year so far, the share of last year's total and the same-days change, with a toggle between this year against last year and month by month, drawn as the ledger draws, linked to the ledger). Records at 390 and 1280 px, light and dark, with Spectrum off and on; Lighthouse on the home at 90 or more.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e`.
- Screenshots at 390 px and 1280 px, light and dark, of every page the PR touches. Since ADR-034 a deployment serves its pictures from the CDN, so a record may be taken from a build with `CDN_BASE_URL` set to the live store, which shows what the site shows; CI's own run has no media.
- A fresh-context audit (`KICKOFF.md`, Audit prompt) per PR; findings fixed or deferred in the PR description.

## Notes

- Imagery and models stay git-ignored and local (ADR-009, ADR-019) and reach a deployment from the CDN (ADR-034); CI, which has neither, renders the front page's cards as toned panels with their captions and no picture inside, and the entry's opening without its figure, the head at a reading width. The ink holomodel can only be seen with the models built locally, so its evidence is the owner's local preview and the session's review screenshots, not the committed ones.
- Branch prefix: `spec/06-almanac/…`. The foundation shipped from `spec/03-almanac/foundation` before this spec existed.
