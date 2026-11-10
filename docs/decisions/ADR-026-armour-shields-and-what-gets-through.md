# ADR-026: Armour, shields and what gets through

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("we need armor and shields here, and if possible we need to be able to say what weapon DPS penetrates armor; SP ship viewer has a great system for armor/shields and understands penetration, we need that but even simpler as a visual or interactive visual", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-012 (the ship file's Weapons and combat section), ADR-016 (reading a part's record for its figures)

## Context

The ship file's Weapons and combat section ranked a ship by hull and mass and listed its stock shields by name; nothing said how hard the ship is to hurt. The game gives every ship an armour record and every ship stock shields, and every gun deals its damage per second by kind. The owner wants both shown, and a simple way to see what a weapon's damage does to the ship.

What the records hold, as the Wiki API serves them and the pack keeps them in `raw` (ADR-016 already reads a part's record this way; ADR-013 the insurance terms):

- The vehicle's `armor`: a health figure and, for each kind of damage (physical, energy, distortion, thermal, biochemical, stun), a damage multiplier, the share of that kind the hull takes once the armour has done its work: a Gladius takes 75% of physical and 60% of energy damage, the rest in full. 246 of 253 ships have one; the multipliers take eight distinct values across the catalog.
- The vehicle's `shield`: the stock shields' health, regeneration per second and face type (bubble or faces). 233 ships have them.
- A gun's `vehicle_weapon.damage.dps` by kind. 173 of 174 guns have it.
- Also there, with no published rule for how the game applies them: the armour's `penetration_resistance` and `deflection` figures, the shields' resistance and absorption ranges (a minimum and a maximum per kind), and a `penetration` figure on two of the 174 guns.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| What is shown | Two facts in Weapons and combat, "Shield strength" (health and regeneration) and "Armour" (the shares that get through), a "Shields" rank bar beside Hull and Mass, and a figure, "Through the armour": a picker of every ship gun on record, and for the chosen gun, each kind of damage it deals as a bar, the whole bar what is fired per second and the filled part what reaches the hull, with the figures beside it and a total; the shields are named first with their health and regeneration | The owner's ask, as a visual that reads at a glance; one accent, ink and paper, like the rest of the file (ADR-020) |
| The arithmetic | What reaches the hull is what was fired times the armour's share for that kind, summed over kinds (`throughArmour`, tested). Nothing else: no time to kill, no shield stage, no penetration | CLAUDE.md section 2: nothing is inferred below the threshold. A product per kind is the record's own meaning of a damage multiplier; every other rule would be a guess at the game's combat model |
| What is left out, and said so | The figure's caption says that shields take the hit whole before the armour, and that penetration, deflection and the shields' resistances are in the records but not applied, their rules being unpublished. Ships whose record has no armour show no figure; no shields on record is said in words | A reader must not take the figure for the game's full model; SPViewer's penetration system rests on rules this project has not got from the records |
| Where the data comes from | `apps/web/lib/armour.ts` reads `VehicleStats.raw` (armour, shields) and `ItemStats.raw` (damage per second by kind), each field checked for shape and every kind's multiplier required, or nothing | The same footing as the loadout editor's figures (ADR-016) and the insurance terms (ADR-013); the pack is unchanged and no stat is hand-entered |
| The default gun | The ship's own heaviest stock gun by damage per second, where it has one; otherwise the first gun on the list | A ship fired on by its own gun is a fair first reading; the reader picks any other |
| Refresh | Nothing new: the fields come with the pack the daily refresh rebuilds on a new build (ADR-023) | |

## Consequences

- Weapons and combat gains two facts, a rank bar and a figure (`through-armour.tsx`, a client component); the compare page is unchanged for now (its shields row already sums the stock loadout's shields).
- `docs/data-model.md` is unchanged: the fields stay in `raw`, read by the site like the editor's.
- When CIG publishes how armour penetration and shield resistances apply, or Phase 1's normalizer reads them from the game files with their rules, the figure can grow a shield stage and a penetration reading; until then it says what it leaves out.
