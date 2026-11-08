# ADR-016: A loadout editor, and the armament drawn by who fires it

- Status: accepted (owner direction 2026-11-08); amends ADR-006 (stock loadout) and ADR-008 (armament strip); spec 02 gains the criterion "Loadout editor"
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

The owner found the hardpoints and loadouts, on flyable ships especially, messy, hard to read and hard to understand, and the guns and missiles drawn as squares and bars hard to make out. The ask: make this the best part of the site, something like a smaller Erkul (the community's loadout and damage calculator): cleaner, easier to use, and easy to see what changes when a weapon or module is swapped, with context a captain can act on. Spec 02 had listed loadout editing as out of scope; the owner's direction moves it in.

CLAUDE.md section 2 rules out copying code from Erkul or any fan tool; the idea is fair game. Nothing was read from Erkul's code.

## Decision

| Concern | Choice |
| --- | --- |
| What can be swapped | Every port on the ship whose type is gun, missile (or torpedo), shield, power plant, cooler or quantum drive, at any depth: a gun inside a gimbal or turret, a missile inside a rack. Fit is the game's own rule as the data states it: the part's type matches the port's and its size is within the port's range. Mounts (gimbals, turrets, racks) are shown as context, not swapped: the data does not say what else a mount port accepts |
| What can be fitted | The pack's catalogue: `scripts/bootstrap-fixtures` now also fetches every ship gun, missile and torpedo, shield, power plant, cooler and quantum drive the Star Citizen Wiki API lists for the pack's build (`CATALOG_TYPES`, 200 records a page), not only the parts on the five ships. A part with the wiki's placeholder name or from another build is left out and counted. The parts also become component pages |
| Figures | Read from each part's record, never computed beyond sums: guns' damage per second while firing, damage per shot, rate, range, projectile speed, damage type and ammunition; missiles' damage, what they track, speed and lock range; shields' health and regeneration; power plants' power segments and coolers' coolant segments; quantum drives' speed, spool and fuel; and what each part draws from the power network (`resource_network`) |
| Editor | `apps/web/lib/loadout-editor.ts` builds the slots and options on the server; `loadout-editor.tsx` is the client. A summary first: gun damage per second, damage per volley, missile damage and count, shields and regeneration, power drawn against power made (in the danger colour when the build draws more than the plants make), quantum speed and spool, each with its change against the stock build, then the gun damage split by type. Then one card per system, one row per port: size, where it is (from the game's port names: "Left wing", "Nose"), its mount, the part fitted and its headline figures. "Change" opens the parts that fit, as a sortable table with each figure's difference from the part fitted now; a filter; "Fit all N matching ports" for pairs and racks; "Leave empty". Rows reset to stock singly or all at once |
| Sharing | The build is kept in the address (`?build=`, changed slots by position and class name) and "Copy link to this build" copies it. A shared address that names a part that does not fit is ignored |
| Armament drawing | Weapons and combat draws the armament by who fires it: the pilot's guns (fixed or on gimbals), each turret type with its guns or missiles (identical turrets counted once, "×2"), then the missile racks. Each part is drawn in profile, a gun with receiver and barrel, a missile with nose and fins, a torpedo heavier and banded, at a length set by its size class on one scale for the page, up to six of each then "+N", with the size, the linked name, the count and what one does. It replaces ADR-008's squares and bars |
| The rest of the loadout | The panels by system (ADR-006) and the port table stay, each behind its own disclosure: "Every fitted part by system" and "All N ports by game name" |

## Consequences

- The bootstrap pack grows by the catalogue (about 500 parts), and with it the components index. It stays a placeholder until Phase 1 extraction, which will produce the same records from the game files.
- Power is shown for the parts in the editor only. Thrusters, life support and other draws are not editable here and are not counted; the summary says "the parts here".
- Concept ships have no loadout data; their section says so, as before.
