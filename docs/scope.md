# Scope — condensed

Full plan with diagrams, budget, and risk register: https://claude.ai/artifact/WsKi1TWpZbxhonv3Dzb6bY

## Thesis

A reference layer for Star Citizen where every ship, component, manufacturer, news item, and CIG developer statement is an entity with a page, cross-linked the way Wowhead links a blue post to the item it discusses. Non-commercial fan project, built solo with Claude Code, under written CIG approval.

## v1 (four modules)

| Module | What ships | Gate |
| --- | --- | --- |
| Ship and component database | Every ship from the ship matrix and every weapon, shield, power plant, cooler, and quantum drive, with specs per channel and version, hardpoints, stock loadouts, variants, paints, compare view | All flyable ships import with zero unknown-shape errors |
| News feed | Comm-Links, patch notes, roadmap and progress tracker changes, RSI YouTube, normalized to one schema, entity-linked, filterable, with RSS and JSON out | Items appear within 15 minutes of publication |
| Dev tracker | Every CIG staff post on Spectrum with author, role, thread, full text; author pages; entity-linked; takedown path | Live, or formally deferred to v1.1 if CIG access is not settled |
| 3D ship viewer | 20 hero ships from game-extracted geometry, two model tiers, orbit and presets, hardpoint hotspots, thumbnails and turntables | 60 fps on the reference laptop; full tier ≤ 25 MB, preview ≤ 8 MB |

## v2 (not in v1 tickets)

- Loadout calculator (Erkul layer): starts only after two clean patch cycles post-launch.
- Hangar and fleet with accounts and RSI handle verification.
- Public API for other fan tools.
- Patch pages generated from pipeline diffs.

## Design bar

A premium reference product, not a game HUD. Restrained, typographic, fast. Linear, Stripe docs, and a Porsche configurator are the references; neon-on-black HUDs and badge-heavy gamer dashboards are the anti-references.

## Decisions already made

- Stack: Next.js, TypeScript, Tailwind, React Three Fiber; Postgres on Neon with Drizzle; Meilisearch on Fly.io; Cloudflare R2 and CDN; Fly.io workers; StarBreaker and gltf-transform in the pipeline. See ADR-001.
- Data contracts: `class_name` identity, channel and version on every stat, immutable published versions, loud import failures, confidence-scored entity links. See ADR-002.
- Budget: roughly $60 to $70 a month at steady state inside a $150 envelope; models never pass through the app server.
- Build order: foundation → data spine → ships UI → news and dev tracker → viewer → launch. Sixteen weeks at two or three sessions a week. Gates, not dates.

## Decisions still open

Name, license, hero ship list, Spectrum access method, donations. Tracked in `CLAUDE.md` section 12.
