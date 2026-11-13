# ADR-054: New and removed entries read Before → After too

- Status: accepted
- Date: 2026-11-12
- Deciders: owner ("when I click into something that was changed, it shows me the change, but not what it was before... we need from to in these sections/drop downs too")
- Amends: ADR-049 ("a new or removed entry has one side only: its figures, not a table of dashes"), ADR-055 (patch-from-to, first numbered ADR-053, which the news clock also took)

## Context

The owner opened the Avenger Stalker on `/patches` and saw a plain list of its figures, with no before. The Stalker is new in 4.10.2: it has no before. But nothing on the entry said so. The "New ships and vehicles" label above the list was the only clue, and an opened entry looked like a change with its old values missing.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The folded line | A New or Removed tag beside the entry's name | The entry says what it is before it is opened |
| The opened entry | A note first: "New in 4.10.2: it was not in 4.10.1, so it has no before", or "Removed in 4.10.2: this is how it stood in 4.10.1". Then the same Before → After table as a changed entry, with a dash on the side where it did not exist; screen readers hear "none" | One grammar for every entry; the empty side is shown and explained, not left out |
| The columns | No Change and no bar columns for a new or removed entry, and no group headings (its few headline figures would make each group one line). The table keeps to prose width from `md` | They would say "New" on every row; the note says it once |
| Recipes | What one craft takes shows Before → After for every recipe, a dash on the side it did not exist | The same rule |

## Amended 2026-11-13: a record that shares a ship’s name

The game keeps variants under one name. 4.10.3 brought a “Caterpillar” record of its own (`DRAK_Caterpillar_Boarded_ShatteredBlade`) while `DRAK_Caterpillar` stayed, and retired the old Hammerhead and Constellation Andromeda and Aquila records while their reworked `_GS` records stayed. The page listed a new “Caterpillar”, and the owner read it as the ship being new (“the drake caterpillar was definitely in the prior patch”).

A new or removed ship that shares its name and maker with another record in either build now:

- shows its class name under its name;
- is tagged “New variant” when its namesake was in the build before, and “Record retired” when its namesake stays;
- has a note naming the other records (`namesakesOf` in `apps/web/lib/patches.ts`).

A name of its own reads as before.

## Consequences

- A figure first stated, or no longer stated, in a changed entry shows the same dash, read as "none".

- `patches.spec.ts` checks that a new ship carries the tag, opens on the note, and has a Before → After table whose Before cells are empty.
