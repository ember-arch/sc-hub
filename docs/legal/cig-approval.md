# CIG approval record

This file holds what Cloud Imperium Games has agreed to in writing. Specs reference the checkboxes below; an unticked box means the dependent work is blocked, not assumed.

Replace every `TBD` before Phase 0 ends. Attach or link the written confirmation (email, Spectrum DM export, or document) in `docs/legal/evidence/` — that folder is git-ignored; keep a copy outside the repo as well.

## Contact

| Field | Value |
| --- | --- |
| CIG contact name | TBD |
| Team | TBD (Community team expected) |
| Channel | TBD (email, Spectrum DM, Discord) |
| Date of first approval | TBD |
| Agreed review cadence | TBD (recommend: a short status note every major patch) |

## What is approved

Tick only what is confirmed in writing. Quote the relevant sentence from the confirmation under each item.

- [ ] **Fankit assets** — use of wallpapers, renders, logos, concept art, and fonts on the site with attribution.
  - [x] The "Made By The Community" badge in every footer (ADR-009): covered by the Fankit Agreement the owner accepted on 2026-11-07 (clause 1, the kit's contents) and asked for by the Fankit Guidelines (page 6); the owner directed it on 2026-11-10. The rest of the box stays open.
  > quote: TBD

- [x] **RSI website images** — ship images copied from RSI's public ship matrix (ADR-009) and the Comm-Link covers copied from RSI's Comm-Link hub (ADR-029), shown on the public site with credit and a link back. Not covered by the fankit or by the Terms of Service fansite grant, which names only content RSI designates for fansite use. Ticked on the owner's word on 2026-11-10; no written confirmation from CIG is on file (the owner's standing direction, ADR-019). Published to the CDN by ADR-034.
  > quote: the owner, 2026-11-10, in the session doing the work: "In uploading all images to the site, use the Vercel Blob store instead, as agreed"; and, asked in his other session "Publish CIG's pictures and models on the live site, ticking the four imagery boxes on your word?": "Yes, publish them"

- [ ] **Game-extracted 3D models and textures** — extraction from `Data.p4k`, conversion to glTF, hosting on the project CDN, in-browser display.
  > quote: TBD
  - Scope confirmed: hero ships only / all ships — TBD
  - Interiors: included / exteriors only — TBD
  - Resolution ceiling, if any — TBD

- [x] **RSI holoviewer models** — the OpenCTM model each ship's pledge page loads into its holoviewer, copied for every ship from the addresses the store's listing gives (ADR-015, ADR-025), packed and shown on the public site in the ship file and the Scale lineup with credit and a link back. Not covered by the fankit or by the Terms of Service fansite grant. Ticked on the owner's word on 2026-11-10; no written confirmation from CIG is on file (the owner's standing direction, ADR-019). Published to the CDN by ADR-034.
  > quote: the owner, 2026-11-10: "Yes, publish them" and "In uploading all images to the site, use the Vercel Blob store instead, as agreed" (the same words as the RSI website images box)

- [x] **Wiki gallery pictures** — CIG's art for each ship, copied from the Star Citizen Wiki's gallery uploads, shown on the public ship pages with credit (ADR-024). Same footing as the RSI website images above. Ticked on the owner's word on 2026-11-10; no written confirmation from CIG is on file (the owner's standing direction, ADR-019). Published to the CDN by ADR-034.
  > quote: the owner, 2026-11-10: "Yes, publish them" and "In uploading all images to the site, use the Vercel Blob store instead, as agreed" (the same words as the RSI website images box)

- [x] **Title icons** — CIG's title (badge) icons, copied from the Star Citizen Wiki's uploads because RSI publishes no list of them, shown on the public titles page with credit (ADR-017). The wiki labels them "Cloud Imperium IP"; neither the fankit nor the Terms of Service fansite grant covers them. The owner allowed the local copy on 2026-11-08 and ticked the box on his word on 2026-11-10; no written confirmation from CIG is on file (the owner's standing direction, ADR-019). Published to the CDN by ADR-034.
  > quote: the owner, 2026-11-10: "Yes, publish them" and "In uploading all images to the site, use the Vercel Blob store instead, as agreed" (the same words as the RSI website images box)

- [ ] **DataCore game data** — extraction and publication of vehicle and item stats for LIVE and PTU.
  > quote: TBD
  - PTU data publication explicitly covered — yes / no — TBD

- [x] **Spectrum developer posts** — republication of CIG staff posts in full, with author names, roles, and links back. Ticked on the owner's word on 2026-11-10; no written confirmation from CIG is on file (the owner's standing direction, ADR-019). The posts are read from Spectrum's public search without any account, two requests a run with the project's User-Agent and contact address (ADR-027), so the question is republication alone; to settle in the same conversation whether CIG would rather provide a feed.
  > quote: the owner, 2026-11-10: "you can tick it - all good and approved"
  - The post's own blocks and pictures (ADR-037): each post is read in full from Spectrum's public thread endpoint, one request per thread, and shown as it stands on Spectrum, the pictures CIG staff attached included, credited "Image: Cloud Imperium Games, via Spectrum" and linked to the post. Covered by this box on the owner's words of 2026-11-10: "we should be replicating the post (images too) as closely as possible" and, asked about publishing CIG's pictures, "Yes, publish them"
  - Access method: Spectrum's public search (no account) / CIG feed or export — the worker reads the public search on the owner's direction (2026-11-10, "can't you find them?"); whether CIG would rather provide a feed is to settle here — TBD
  - Collection before approval: the worker writes what it reads into this private repository and nothing reaches the site. The owner decided on 2026-11-10 that the collection goes on before CIG is asked ("Keep collecting"), and the repository variable `SPECTRUM_MODE` is set to `poll` on that word; the republication question above stays open
  - Retention: indefinite / N months — TBD
  - Takedown: who to contact and within what time — TBD

- [ ] **Donations or passive ads** — permitted / not permitted. Assume not permitted until this box is ticked.
  > quote: TBD

- [ ] **Site name** — CIG has seen the chosen name and raised no objection.
  > quote: TBD

## What was asked for and declined or not answered

Record it here so the ask is not repeated by accident.

| Ask | Date | Outcome |
| --- | --- | --- |
| | | |
