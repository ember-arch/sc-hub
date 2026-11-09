# ADR-015: RSI's holoviewer models, RSI's loaner matrix, full-size art and section order

- Status: accepted (owner direction 2026-11-08); amends ADR-012 (hologram, model source), ADR-013 (loaners), ADR-014 (section order, opening band, render loops); the CIG-holoviewer look is withdrawn by ADR-020, which draws the same models in ink
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

Reviewing the ship files of ADR-014, the owner asked for:

- the exact holoviewer models from RSI's own pledge pages, with the same holoviewer effects;
- opening-band art that stays sharp on high-density and 4K screens (the Perseus looked grainy);
- the Odin's cut-out moved left, because its bow was cut off;
- loaners from RSI's loaner ship matrix (the Odin's is the Idris-P, but the page said "Not on file"), checked weekly;
- the combat render loop shown whole, so every weapon port opening is visible;
- Weapons as section 3 and Crew and operations as section 4 on every ship.

## Decision

| Concern | Choice |
| --- | --- |
| Models | Each ship's model is the OpenCTM file its RSI pledge page loads into the holoviewer. The URLs (read from each pledge page on 2026-11-08; the ship matrix does not list them) live in `scripts/media/holo.ts`, with the human figure RSI stands beside every ship. `scripts/media/fetch-holo.ts` copies them into `fixtures/holo/` (git-ignored; `sources.json` records URL, size, SHA-256, vertex and triangle counts), one request every 5 seconds. FleetYards' converted models are no longer used, so their permission is no longer needed |
| Decoding | `scripts/media/ctm.ts` (OpenCTM RAW, MG1, MG2) and `scripts/media/lzma.ts` (an LZMA decoder written from the public-domain specification) read the geometry at build time. `scripts/media/holo-glb.ts` packs it as glTF in metres, 16-bit quantized positions (KHR_mesh_quantization) and meshopt compression (EXT_meshopt_compression); three.js decodes it with its bundled decoder, so no Draco files are served. The Odin is 2.05 MB (FleetYards' was 9.7 MB). Normals are derived in the viewer. No code from RSI or any fan tool was copied |
| Scale | RSI's files are not all to scale (RSI's holoviewer fits each to its frame): the Odin's is half size, the Polaris's two fifths. The viewer scales each model to the length on record (the pack's, or RSI's matrix figure for a concept), so the person beside it is true to scale |
| Drawing | The viewer reproduces RSI's holoviewer with this project's own shaders: the ship materialises out of noise with a bright seam, scan planes sweep it along its length, beam and height, and it settles as a lit cyan hologram with a bright rim, over a floor grid in round metres on a dark backdrop, with the person standing beside it. Render: Default, X-ray (translucent, bright at the silhouette) and Wireframe (feature edges over a faint body). View: Orbit, Front, Back, Left, Right, Top, Bottom, each easing the camera into place; Full screen. Reduced motion: no materialising, sweeps, orbit or easing |
| Rule exception | The CLAUDE.md section 2 exception (ADR-012) covers the backdrop and floor grid as well as glow and scan bands: they are part of how CIG draws its holoviewer, and they stay inside the canvas. The View and Render controls are ordinary interface buttons in the design system |
| Opening-band art | Ship images come from RSI's original upload (`source`) instead of the 1920 px wallpaper: 3436 to 5732 px wide. Ship renditions gain 3840 and 2560 px, showcase renditions 5120 and 3840 px. The Perseus's band is its ship-matrix wallpaper at 3840 px (it was a 2539 px article render); the wallpaper leaves the Combat section so it is not shown twice |
| Odin cut-out | Superseded by ADR-021 (2026-11-09): the cut-out is laid over the key background inside the entry's cover, scaled to the band above the name (to the right on wide screens, centred on phones) so no part of the ship is cropped. CIG's cut-outs face right |
| Render loops | A loop keeps its own proportions (`width` and `height` read from the MP4's track header by `scripts/media/mp4.ts`, carried in the manifest). The Odin's weapon-ports loop is 1920 by 580 and is no longer cropped to 16:9 |
| Section order | Brief, Acquisition and status, Weapons and combat, Crew and operations, Mobility, Scale, Specifications, Hardpoints and loadout, Sources. The section id stays `combat` |
| Scale lineup | The owner asked for the Scale section to use the holoviewer instead of line drawings. The row is laid out from the recorded lengths before any model arrives (a model scaled to its length is exactly that long along the row), so the paper, ground line and camera are up at once, every download starts together, each ship is drawn where it stands as its own model lands and its inked edges follow in an idle moment; the caption counts the models in (owner, 2026-11-09: the lineup loaded slowly when it waited for the whole set). Every ship with an RSI model (the pack's and the Odin) stands in profile on one floor grid in a wider holoviewer canvas (`holo-lineup.tsx`), each scaled to its recorded length, largest first, the person RSI uses beside the smallest. The page's ship is lit full, the others dimmed. It opens on the page's ship with the next larger ship and every smaller one ("Around the Gladius"); "All ships" shows the row; one button per ship flies the camera to it. Labels name ships drawn large enough to read. The shaders and loading are shared with the holoviewer (`holo-kit.ts`). Without the models built, or with no other ship, the drawn lineup (`ScaleLineup`) stays |
| Loaners | From RSI's loaner ship matrix, the support article that lists every ship that is not flight ready with what RSI lends for it. `scripts/bootstrap-fixtures/loaners.ts` reads it through the help centre's public article API (one request) into `fixtures/acquisition/LoanerMatrix.json`, keeping RSI's own "Last updated" date and build, and halts on a table it does not recognise. A ship matches a row that names it ("Carrack / Carrack Expedition" names the Carrack, "Carrack w/ C8X" does not) or its family ("Fury Variants"). A flight-ready ship not on the matrix says so. The wiki's loaner list (ADR-013) is dropped: it was stale (it gave the Perseus a Harbinger and a Polaris) |
| Weekly check | `.github/workflows/loaner-matrix.yml` runs the script every Monday at 09:17 UTC and on demand. The script writes only when RSI changed the article; on a change the workflow pushes `data/loaner-matrix-<date>` and opens a pull request for review, or an issue naming the branch if Actions may not open pull requests. Scheduled workflows run from the default branch, so the check starts once this lands on `main` |

## Consequences

- `fixtures/holo/` is a new git-ignored folder (with a committed README and `sources.json`), like `fixtures/rsi-media/`. Publishing RSI's models on the public site falls under the same open CIG question as the images (`docs/legal/cig-approval.md`).
- `Showcase.model` stays in the schema for old manifests and is always null; `MediaManifest` gains `holo` and `holo_figure`. `ShipLoaner` is replaced by `LoanerMatrix`.
- `meshoptimizer` 0.18.1 (MIT, already in the lockfile through `@types/three`) becomes a root dev dependency for the build script.
- The Draco decoder is no longer copied into `/media/draco/`.
