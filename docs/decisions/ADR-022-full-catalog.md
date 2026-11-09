# ADR-022: The full catalog from the Star Citizen Wiki API, until Phase 1

- Status: accepted
- Date: 2026-11-09
- Deciders: owner ("now once you finish build out the full ship catalog and all of the ship pages (both live and in concept)", 2026-11-09), Claude Code session 2026-11-09

## Context

The bootstrap pack (ADR-004) holds six ships and one concept ship so the pages could be built against real records. The owner now wants every ship on the site: the flyable ones with their game data, and every ship RSI has announced but not shipped, with RSI's published figures. Phase 1 (spec 01) will take this data from the game files through the pipeline; it is not built, and the owner wants the catalog now.

The same sources that fed the bootstrap can feed the whole catalog: the Wiki API lists every vehicle in the current build with its ports and stock loadout, RSI's ship matrix lists every announced ship with its status and figures, and RSI's ship pages carry one image per ship. The scripts already exist; they were held to six ships by rule.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Flyable ships | `scripts/bootstrap-fixtures` fetches every vehicle the Wiki API lists for the current build when `ships.json` says `"all": true`: the vehicle list is paged, each record is fetched by uuid with its hardpoints, every stock component once, then the loadout editor's catalogue as before. The six-ship list stays for a quick rebuild and the tests | One run of a few hours at the polite limit (CLAUDE.md section 9): some 250 vehicles, then every distinct stock component, several thousand, one request each; a response cache (`BOOTSTRAP_CACHE_DIR`) lets a halted run resume without refetching; the mapper, the halting rules and the pack validation are unchanged |
| The pack's size | The 2 MB cap of spec 00 becomes 40 MB. The pack is committed as before: it is the site's only data until Phase 1, and CI and deployments must render it | CLAUDE.md section 4 says fixtures are "small, committed"; the full catalog is not small. The alternative, a local-only pack, would leave CI and every deployment with six ships |
| Concept ships | `scripts/media/snapshot-matrix.ts` keeps every ship-matrix row whose status is not flight ready and whose name and maker are not in the pack, not only the showcase ships. Slugs are the kebab-case name, prefixed by the maker where names collide, never one the pack already uses; a showcase ship keeps its curated slug | Every announced ship gets an entry with RSI's figures, labelled as such (ADR-010) |
| Images | `scripts/media/fetch-rsi.ts` fetches RSI's ship-matrix image for every pack ship and every concept ship, one request every 5 s, and `prepare.ts` writes the concept ships' images into the manifest under `concepts`, keyed by slug. All of it stays local and git-ignored (ADR-009); the owner's instruction to proceed as if CIG approved the imagery stands (ADR-019) | The pages need a picture to be entries; the footing does not change |
| Holoviewer models | Not fetched for the catalog: each model's address is on its RSI pledge page, and reading three hundred pages is a further decision. The showcase ships keep theirs | A page without a model still has its particulars, figures and sections; the lineup draws the ships that have models |
| What the site does | Nothing new: the register, the entries, the compare basket, the palette and the sitemap already take whatever the pack holds; the front page shows ten entries and five bento cards whatever the count | The pages were built for the full catalog from the start |

## What the full list taught the mapper

- Dummy hardpoints: some vehicles (first seen on the Greycat MDC) declare a port with an empty name, an empty type and nothing mounted. The data model keys ports by name, so such a port is counted under `excluded` as `unnamed` and left out; an unnamed port that carried a part would halt the run, as every unknown shape does.

- Unlisted variants: 57 of the 310 vehicles in the build have no production status, because RSI's ship matrix does not list them: event and reward variants (the Wikelo specials, the PYAM Exec editions, the Alliance and Star Kitten paints, the Mauler Destroyer). The data model needs a status, so they are counted under `unlisted` and left out; folding them under their base ships as variants is a later decision.
- No size class: the wiki writes the literal "undefined" where the game files class no size (ten ground vehicles, the Ballista among them). `size_class` is nullable for exactly that, so the mapper returns null there; every other size is one of the data model's six.
- Twenty-seven hardpoint types the six ships never showed, placed in the mapper's vocabulary tables the way the first set was: bomb and ground-vehicle missile launchers as missile racks and bombs as missiles, external fuel tanks as fuel tanks, utility turrets as turrets, mining weapons as mining lasers, towing beams as tractor beams, EMPs, quantum interdiction generators, salvage heads and mining and salvage modifiers as utility components; containers, modules, ammo boxes, salvage field emitters, supporters, filler stations and internal storage, tool arms, weapon mounts and the literal `UNDEFINED` as other ports (real, no component kind yet); control panels, decals, floor flair, lights and target selectors excluded as fittings and cosmetics.
- Duplicate names: 19 names are shared by two or three vehicles with a status (sale editions such as `_BIS2950`, `_GS` and `_Plat`, and four showroom `_Display` copies). They stay in the pack as the game files have them and the slug rules give each its own slug (the maker prefix, then the class name). The Wiki API exposes no base relation, so the mapper reads it off the identifiers (`scripts/bootstrap-fixtures/editions.ts`): within one maker and one name, a vehicle's base is the longest other class name that is a proper prefix of its own at an underscore (`RSI_Polaris_Collector_Military` → `RSI_Polaris`, `RSI_Constellation_Andromeda_GS_Display` → `RSI_Constellation_Andromeda_GS` → `RSI_Constellation_Andromeda`), written to `base_variant_of`, the data model's field for exactly this; a same-name vehicle that extends no other is reported, never guessed. The site lists an edition under its base (`Repository.entries`, `apps/web/lib/editions.ts`): the register, the front page, search, compare, the maker's lineup, related ships and the sitemap show entries; an edition keeps its page, reached from the base's "Editions" line and pointing its canonical link at the base. A variant with a name of its own (a Gladius Valiant) stays an entry.

## Consequences

- `fixtures/bootstrap` grows from six ships to every ship in the build; the pack README says so; `PACK_BYTE_LIMIT` is 40 MB; CLAUDE.md section 4 reads "committed; the catalog since ADR-022".
- `fixtures/ship-matrix/ConceptShip.json` holds every announced ship; the Odin keeps its showcase.
- A full `next build` renders a few hundred ship pages; the register table carries them all. Lighthouse on the register and the front page stays a gate.
- Phase 1 replaces the pack's origin, not its shape: the import job will read the same entities from the game files.
