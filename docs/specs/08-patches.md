# Spec 08 — What changed: the patch pages

- Phase: between spec 07's catalog and Phase 1's data spine
- Machine: owner's PC or laptop for the first fetch (the Wiki API, at the polite limit); any machine for the site
- Gate: the latest patch, an earlier patch, the PTU page and a two-build comparison render on a preview of `main`, light and dark, phone and desktop, with Lighthouse performance and accessibility ≥ 90 on `/patches`

## Goal

The owner's direction (2026-11-11): "What changed this patch" pages: stat changes between builds for every ship, part and blueprint, patch against patch and the current patch against the PTU, beautifully designed, easy to navigate, in collapsible sections, clearer and easier to reach than the patch notes alone, with the notes linked (ADR-049).

## Out of scope

- Phase 1's `diff.json` and PTU extraction (spec 01); the PTU comparison lights up when a PTU snapshot exists.
- The ship page's "Changed in this version" section (spec 01 notes); a follow-up.
- Classifying note lines by topic, or rewording them.

## Acceptance criteria

- [x] **Snapshots.** `scripts/patches/fetch.ts` writes `fixtures/patches/<build>.json.gz` for every build the Wiki API lists (ships with their loadouts, parts of twenty types, blueprints), validated against `PatchSnapshot` and written as `PatchSnapshotFile`; a file on disk is never rewritten; the mapper has fixture tests on cut API answers (`fixtures/patches/samples/`); the daily refresh fetches a build that has no file.
- [x] **Comparison.** Any two snapshots compare into ships, part families and blueprints, each added, removed or changed by figure (ships also by refitted port, blueprints by ingredient); a figure one build does not record for any entry of its kind is counted, not shown; unit tests pin each rule.
- [x] **Patch notes.** CIG's posts for the builds compared are matched by title, shown once each, laid out in CIG's own sections when the pack holds their paragraphs and linked otherwise; note lines that name a ship by its full name appear in that ship's entry; unit tests on the news pack.
- [x] **Pages.** `/patches` (the latest patch), `/patches/<version>` (each earlier patch), `/patches/compare` (any two builds) and `/patches/ptu` (PTU against LIVE) share one layout: three ways in, the two builds, four figures, a rail with the sections and the patch history, a filter, folding sections in CIG's order, figure tables with units and changes written with an arrow, never colour alone; "Patches" in the header; the legal footer, sitemap and e2e tests cover them.

- [x] **Released ahead of its figures.** When CIG has released a LIVE version (its release notes, official notes or a hotfix post on the pack) newer than the figures on record, the footer names it beside the build the figures are from, the patch masthead and latest tab name it, and `/patches` opens on one line, "N is live", with a link to its release notes, the comparison on record straight under it (redesigned 2026-11-13: the owner found the posts listed there a running tally in the way); unit tests on `releasedAhead` and the strip, an e2e check that the page and the strip agree (ADR-049, amended 2026-11-12).

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e`.
- Screenshots at 390 px and 1280 px, light and dark, of `/patches`, an entry opened, and `/patches/ptu`.
- A fresh-context audit (`KICKOFF.md`, Audit prompt); findings fixed or deferred in the PR description.
