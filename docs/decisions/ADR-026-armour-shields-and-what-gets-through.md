# ADR-026: Armour, shields and the armour's damage multiplier

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("we need armor and shields here, and if possible we need to be able to say what weapon DPS penetrates armor; SP ship viewer has a great system for armor/shields and understands penetration, we need that but even simpler as a visual or interactive visual", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-012 (the ship file's Weapons and combat section), ADR-016 (reading a part's record for its figures)

## Context

The ship file's Weapons and combat section ranked a ship by hull and mass and listed its stock shields by name; nothing said how hard the ship is to hurt. The game gives every ship an armour record and every ship stock shields, and every gun deals its damage per second by kind. The owner wants both shown, and a simple way to see what a weapon's damage does to the ship.

What the records hold, as the Wiki API serves them and the pack keeps them in `raw` (ADR-016 already reads a part's record this way; ADR-013 the insurance terms):

- The vehicle's `armor`: a health figure and, for each kind of damage (physical, energy, distortion, thermal, biochemical, stun), a damage multiplier: a Gladius's armour multiplies physical damage by 0.75 and energy by 0.6, the other kinds by 1. 246 of 253 ships have one; the multipliers take seven distinct sets of values across the catalog. Beside it, with no published rule for how the game applies them: a resistance multiplier per kind (above 1 for energy on most ships), deflection, penetration resistance, and the ship's own penetration multiplier.
- The vehicle's `shield`: the stock shields' health, regeneration per second and face type (bubble or faces). 233 ships have them.
- A gun's `vehicle_weapon.damage.dps` by kind. 173 of 174 guns have it.
- The shields' absorption and resistance ranges (a minimum and a maximum per kind), likewise without a published rule; and an ammunition penetration block on 27 of the 174 guns, none on the gun itself.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| What is shown | Two facts in Weapons and combat, "Shield strength" (health and regeneration) and "Armour" (the multipliers that are not 1: "Physical ×0.75, energy ×0.6"), a "Shields" rank bar beside Hull and Mass, and a figure, "After the armour": a picker of every ship gun on record, and for the chosen gun, each kind of damage it deals as a bar to one scale across every gun, the whole bar the damage per second fired and the filled part the same times the armour's multiplier, with the figures beside it and a total; the shields, hull and armour health on record are named above it | The owner's ask, as a visual that reads at a glance; one accent, ink and paper, like the rest of the file (ADR-020) |
| The arithmetic | Each kind fired times the armour's damage multiplier for that kind, summed over kinds (`afterArmour`, tested), and the figure calls the result what it is, "after the armour": not what reaches the hull, which would need the records' other figures and their rules. No time to kill, no shield stage, no penetration | CLAUDE.md section 2: nothing is inferred below the threshold. A product is the record's own meaning of a multiplier; naming its result the hull's fate, or applying any other figure, would be a guess at the game's combat model (the audit of PR 29 caught the first wording, which claimed both) |
| What is left out, and said so | The figure's caption lists every figure the records hold and the site does not apply: the armour's resistance multipliers, deflection and penetration resistance, the ship's penetration multiplier, the shields' absorption and resistance ranges; and says no shield stage is applied. Ships whose record has no armour show no figure; no shields on record is said in words | A reader must not take the figure for the game's full model; SPViewer's penetration system rests on rules this project has not got from the records |
| Where the data comes from | `apps/web/lib/armour.ts` reads `VehicleStats.raw` (armour, shields) and `ItemStats.raw` (damage per second by kind), each field checked for shape and every kind's multiplier required, or nothing | The same footing as the loadout editor's figures (ADR-016) and the insurance terms (ADR-013); the pack is unchanged and no stat is hand-entered |
| The default gun | The ship's own heaviest stock gun by damage per second, where it has one; otherwise the first gun on the list | A ship fired on by its own gun is a fair first reading; the reader picks any other |
| Refresh | Nothing new: the fields come with the pack the daily refresh rebuilds on a new build (ADR-023) | |

## Consequences

- Weapons and combat gains two facts, a rank bar and a figure (`through-armour.tsx`, a client component); the compare page is unchanged for now (its shields row already sums the stock loadout's shields).
- Deferred from the audit: the fallback gun where a ship has no stock gun is the first on the list (a size 1, alphabetical) and the figure does not say so; "per second" is burst damage per second as the record's `dps` gives it, not the sustained figure; a new damage kind in the records would be ignored until added to `DAMAGE_KINDS`; the default-gun choice has no unit test.
- `docs/data-model.md` is unchanged: the fields stay in `raw`, read by the site like the editor's.
- When CIG publishes how armour penetration and shield resistances apply, or Phase 1's normalizer reads them from the game files with their rules, the figure can grow a shield stage and a penetration reading; until then it says what it leaves out.
