# Spec 04 — 3D ship viewer

- Phase: 4 (weeks 11 to 15; overlaps Phase 3's tail)
- Machine: Windows PC for export and optimization; laptop for the viewer
- Gate: 60 fps on the reference laptop (2022 MacBook Air or equivalent) for every hero ship; full tier ≤ 25 MB and preview tier ≤ 8 MB; preview visible within 3 s on throttled 4G
- Blocking dependency: `docs/legal/cig-approval.md` → 3D models box ticked, with scope confirmed

## Goal

The differentiator: 20 hero ships rendered in the browser from game-extracted geometry with real materials, loading fast enough that the ship page still meets its budget, with hardpoint hotspots that link to component pages, plus pre-rendered thumbnails and turntables for cards, search, and social previews.

## Out of scope

Interiors (unless approval scope includes them and the budget holds). Paint switching. Animation (landing gear, doors). All non-hero ships beyond thumbnails.

## Acceptance criteria

- [ ] **Hero list.** `pipeline/hero-ships.json` holds 20 `class_name`s chosen by the owner against the criteria in `docs/scope.md`; `is_hero` set on import.
- [ ] **Export.** `pnpm pipeline:models --ship <class_name>` runs the StarBreaker entity export to GLB with materials and textures, records triangle count, texture count and resolutions, and elapsed time in the run log.
- [ ] **Optimization pipeline.** gltf-transform steps in a fixed order (dedup, prune, weld, instance where possible, quantize, meshopt compression, KTX2 textures with a resolution cap per tier), producing `preview` and `full` GLBs; a report per ship with before and after sizes and triangle counts.
- [ ] **Budgets enforced.** The pipeline fails a ship whose full tier exceeds 25 MB or preview exceeds 8 MB, printing which textures or meshes dominate; a per-ship override file records any approved exception with the reason.
- [ ] **Publish.** Models upload to `models/<class_name>/<game_version>/<tier>.glb` with checksums; `Model` rows written by the import job; CDN cache headers set for a year with versioned paths.
- [ ] **Viewer.** React Three Fiber component on the ship page hero: loads preview first, swaps in full when ready; orbit and zoom; preset cameras (front, side, top, three-quarter) with 320 ms eased transitions; a size-reference toggle (human figure at 1.8 m); `prefers-reduced-motion` disables camera animation; static fallback image when WebGL is unavailable or the device is low-end (heuristic recorded in an ADR).
- [ ] **Hotspots.** Hardpoint positions exported from the entity hierarchy where StarBreaker exposes them; clickable markers open a small card naming the port, size, and stock item, linking to the component page. Ships without exportable positions show hotspots off with no broken UI.
- [ ] **Thumbnails and turntables.** Headless Three.js in Playwright renders a 3/4 view thumbnail at three sizes and a 24-frame turntable sprite for every hero ship, and a thumbnail for every non-hero ship that exports cleanly at preview tier; outputs go to R2 and replace fankit placeholders on cards, search results, and Open Graph images.
- [ ] **Performance.** Ship page LCP still under 1.5 s (the preview model is not the LCP element; the hero poster image is); viewer reaches 60 fps on the reference laptop for every hero ship, measured by a Playwright perf script and recorded per ship.
- [ ] **Accessibility.** Viewer has a text alternative (ship name and view), keyboard focus order is sane, and controls have labels.
- [ ] **All 20 hero ships live** on the preview deployment with their reports attached.

## Suggested order

1. One ship end to end (Prompt W2): export, optimize, report, upload, viewer loads it. Decide tier caps are achievable or adjust with an ADR.
2. Viewer polish: presets, size reference, fallback, reduced motion.
3. Hotspots on the first ship; generalize.
4. Thumbnails and turntables.
5. Remaining 19 ships in batches of five; attach reports.
6. Performance script and the per-ship fps table.

## Verification

Per-ship report table in the PR (sizes, triangles, fps); Playwright perf run attached; the owner views three ships on a phone and the reference laptop and approves.

## Notes

- Texture resolution is the lever. Start at 2048 for full and 1024 for preview; drop per ship only when the cap fails.
- Keep the raw StarBreaker output outside the repo (`pipeline/out/`), only the optimized tiers go to R2.
