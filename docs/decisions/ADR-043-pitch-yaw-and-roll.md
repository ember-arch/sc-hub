# ADR-043: Pitch, yaw and roll in Mobility

- Status: accepted
- Date: 2026-11-11
- Deciders: owner ("in mobility we should have pitch yaw and roll represented too", 2026-11-11), Claude Code session 2026-11-11
- Amends: ADR-012 (the ship file's Mobility section)

## Context

The ship file's Mobility section shows SCM and NAV speed as facts and rank bars, the stock quantum drive and the mass. How quickly a ship turns, which pilots compare first after speed, was not shown.

Every vehicle record the Wiki API serves carries an `agility` block, kept in `VehicleStats.raw` like the armour (ADR-026): `pitch`, `yaw` and `roll`, the same three with `_boosted` (the afterburner's rates, which the record's `afterburner` block derives with its own `*_boost_multiplier`), and an `acceleration` block. On the pack of 2026-11-10 all 253 records have the block; 32 (ground vehicles, the ATLS suits) carry zero or nothing for the axes. The figures read as degrees per second, the unit the Star Citizen Wiki prints beside them on its ship pages: a Gladius 68, 52 and 200, an Idris-P 6, 6 and 11.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| What is shown | Three facts in Mobility, after the speeds: "Pitch", "Yaw" and "Roll", each the rate and the boosted rate ("68 °/s, 81.6 boosted"); and three rank bars after SCM and NAV speed, "Quickest of the N ships on record", by the unboosted rate | The owner's ask, in the section's own grammar of facts and rank bars |
| Where it comes from | `apps/web/lib/agility.ts` (`agilityOf`) reads the record's six figures, each checked as a positive number; any axis missing or zero means no turn rates for that ship, and the facts and bars are left out | The same footing as the armour and the loadout editor's figures (ADR-013, ADR-016, ADR-026); nothing hand-entered, nothing computed |
| What is not shown | The `acceleration` block and the no-fuel modifiers | Not asked; the acceleration block holds only a VTOL figure on this pack |

## Alternatives considered

| Option | Why not |
| --- | --- |
| One fact "Pitch, yaw, roll: 68 / 52 / 200 °/s" | Compact, but three values behind one label hide which is which on a phone, and the boosted rates would make it six |
| Rank by the boosted rate | The unboosted rate is the one a ship holds; the boosted one is in each fact |

## Consequences

- `apps/web/lib/agility.ts` and its test on the committed pack; the Mobility section of every ship with turn rates gains three facts and three rank bars; the ship records change.
- Refresh: nothing new, the block comes with the pack the daily refresh rebuilds (ADR-023).
