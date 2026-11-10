# ADR-009: Where ship images and maker logos come from

- Status: accepted for local development; publishing these images on the public site is still the owner's decision (see "Not decided")
- Date: 2026-11-07
- Deciders: owner, Claude Code session 2026-11-07

## Context

The cinematic ship page concept (ADR-008) had no imagery. The owner downloaded the CIG fankit on 2026-11-07 (accepting the Fankit Agreement), and it turned out to have no image of each ship. It holds manufacturer logos, 38 unlabelled scenic wallpapers with a Star Citizen watermark baked into a corner, 14 low-poly 2019 "holoviewer" models (`.ctm`, of which only the Cutlass Black is one of the five ships in the bootstrap pack), music and fonts.

The owner then asked to "pull the images, models etc. from other sites like FleetYards, StarJump… or pull them directly from the RSI website when needed", since they are CIG assets in the end.

What the sources say, read on 2026-11-07:

- **Fankit Agreement** (in the kit, `06_Fankit_Agreement_2025_11_19.pdf`): a revocable, non-commercial permission for the fankit's own contents; a fixed notice wherever its assets appear (clause 2(g)); no removing watermarks or notices (2(j)); give CIG the site's URL (2(k)); it grants nothing for CIG property outside the kit (12).
- **Fankit guidelines** (`08_Fankit_Guidelines.pdf`): the "Made By The Community" logo in a corner of fankit images at 50% opacity or more; the trademark line visible on the home page or in an always-visible area; never recolor, flip, distort, outline or add effects to an asset.
- **RSI Terms of Service, section XIII.D "Personal and Fansite Use"**: fan sites may reproduce images and marks RSI "expressly designate[s] for fansite use", with an "unofficial fansite" notice, RSI's notices kept, no modification, non-commercial. Store and ship-matrix images are not designated that way.
- **RSI Terms of Service, conduct rules**: no "bots", "spiders", "scrapers"… "data scraping or harvesting"; the stated sanction is on the RSI account.
- **Fankit and Fandom FAQ**: images of RSI IP shared under its fan-site guidance are "generally exempt" from needing written permission; no permission to post CIG content "to … 3d modelling, or other content websites for … download by others".

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Ship images | RSI's own image for each pack ship, the `wallpaper_1920x1080` size from its public ship matrix (`robertsspaceindustries.com/ship-matrix/index`) | The source of every copy other sites carry; one official image per ship, named by CIG, so nothing is identified by eye |
| Matching | A pack vehicle gets a ship-matrix row's image only when the name and the manufacturer code are both identical and exactly one row has them; anything else is reported and gets no image (`scripts/media/sources.ts`, `matchShips`). Whitespace at the ends of a name is not a difference: the matrix writes a stray trailing space after a few names ("Ballista ", "A1 Spirit "), which kept six ships without a picture until 2026-11-10 | CLAUDE.md section 2: no entity link below the confidence threshold. The fankit wallpapers stay unused for ships for the same reason: none is labelled |
| Other fan sites (FleetYards, StarJump and the like) | Not used | Their servers and bandwidth, and some of their renders and converted models are their own work. Going to RSI directly gets the same CIG images without either problem |
| Fetching | `scripts/media/fetch-rsi.ts`: one request for the ship matrix, then one per matched ship, at least 5 seconds apart (CLAUDE.md section 9), with a project User-Agent and no cookies or signed-in session; only the pack's ships | Polite, attributable and never tied to the owner's RSI account, which the scraping clause puts at risk |
| 3D models | None fetched from RSI at first. RSI's ship pages do not expose a model file in their HTML, and digging into its internal APIs is the scraping the terms forbid. The fankit's Cutlass Black holoviewer model is unpacked locally and unused. Superseded: ADR-015 copies the holoviewer models the pledge pages show, and ADR-025 reads their addresses from the store's listing, on the owner's direction (ADR-019); the "RSI holoviewer models" box in `cig-approval.md` is the standing question | The sanctioned path for models stays the Phase 4 extraction pipeline, which also needs the "Game-extracted 3D models" approval in `cig-approval.md` |
| Maker logos | The fankit's logos for the six pack makers that have one: Aegis Dynamics, Anvil Aerospace, Drake Interplanetary, MISC, Mirai, Roberts Space Industries. The dark mark on light pages and the light mark on dark pages; Mirai has no light wordmark, so dark pages get its icon mark, which is drawn for dark grounds | Fankit content, designated for fan use. Never recolored to make a missing version (guidelines section 3) |
| Storage | Originals in `fixtures/rsi-media/` and `fixtures/fankit/`, git-ignored; only `fixtures/rsi-media/sources.json` (where each image came from, with its checksum) and its README are committed. `scripts/media/prepare.ts` builds web copies (WebP; ship images at 1920, 1280, 960, 640 and 480 px wide, logos 128 px tall) and `apps/web/public/media/manifest.json`, also git-ignored. New folders `fixtures/rsi-media/` and `scripts/media/` are recorded here (CLAUDE.md section 4) | No CIG image enters git or a deploy. A clone, CI and Vercel have no images and every page renders without them |
| Serving | Locally, the static files in `public/media/`, never through the image optimizer or an API route. In production they belong on the CDN (CLAUDE.md section 2), which waits for R2 and for the decision below | Same rule as every large asset |
| Display | The ship image leads the ship page's stage, full width, 16:9, capped at 80% of the viewport height (`max-h-[80svh]`, the one arbitrary size this adds) and cropped only at that cap; it is the page's largest paint, so it loads eagerly with high priority. Credit under it: "Image: Roberts Space Industries", linked to the ship's RSI page. Cards show the same image with an empty alt (the card names the ship), lazily except the ships list's first card, which is usually the page's largest paint and loads at high priority. Both the stage image and card images sit inside `<picture>`, where React adds no preload hint; otherwise every page that links to a ship or to the list (the nav does) would download those images when Next prefetches the link (measured). Logos sit above the name on the ship stage and manufacturer pages. No overlay, gradient, tint or filter on any image | RSI's terms require its notices and forbid modification; the fankit guidelines forbid effects; system.md lists gradient hero banners as an anti-reference |
| Notices | The footer adds the Fankit Agreement's clause 2(g) notice verbatim (`FANKIT_NOTICE` in `packages/ui/legal.ts`) on every page, beside the existing fan-site disclaimer and trademark line | Required wherever fankit assets appear; the site shows CIG material on every page |

## Not decided (the owner's)

- **Publishing these images.** RSI's fansite permission covers only content it designates for fansite use, which is the fankit. Showing RSI's ship images on the public site relies on the FAQ's "generally exempt" wording and on common fan-site practice, not on an express grant. `docs/legal/cig-approval.md` has no box for it and its "Fankit assets" box is unticked. Until the owner decides, and records it there, the images stay local.
- **Fetching beyond the pack.** The fetch script is limited to the pack's ships. Running it for every ship is closer to the harvesting RSI's terms forbid; widening it is the owner's call.
- **Giving CIG the site URL** (Fankit Agreement 2(k)) once the site has one.
- **The "Made By The Community" logo.** The guidelines ask for it on fankit images. The site shows no fankit image yet (logos are marks, not artwork), so nothing carries it; the first fankit wallpaper or render that appears needs it.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Hotlink RSI's CDN | Routes RSI's bandwidth through our pages and breaks when RSI moves a file; ADR-008 already rejected it |
| Assign fankit wallpapers to ships by eye | Unlabelled; a wrong guess is a wrong entity link and the Fankit Agreement asks for accurate information |
| Crop fankit wallpapers to fit a frame | Would cut off the baked-in watermark, which clause 2(j) forbids removing |
| Use next/image | Its optimizer resizes on the app server, which CLAUDE.md section 2 rules out for images |

## Consequences

- One schema addition: `MediaManifest` in `packages/schema/media.ts`.
- `sharp` becomes a root dev dependency for the prepare script.
- `Card`, `Hero` and the ship stage take images; `Mark` draws a maker's logo for the page's theme with two CSS rules in `globals.css`.
- The legal e2e test asserts the new notice on every audited route; `e2e/media.spec.ts` checks that drawn images load, are sized and are credited, and passes trivially where no media was built.
