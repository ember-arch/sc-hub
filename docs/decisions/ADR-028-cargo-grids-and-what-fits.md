# ADR-028: Cargo grids, the boxes that stand on them, and the fitting list

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("another addition to the ship pages would be a visualization of the cargo grid for each ship and what boxes in what configurations will fit, and even more importantly what ships and vehicles can fit in the hangars or storage areas of each ship; the redditor has a great list that he keeps updated with each patch"; then, on the list's standing against CLAUDE.md section 2, "you can trust the redditor's measurements and fit, I have validated them", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-012 (the ship file's sections), ADR-023 (the daily refresh's steps)

## Context

The ship file stated a ship's cargo in one figure, the SCU of its particulars. The owner wants two more things: each ship's cargo grids drawn with the boxes that fit them, in the manner of Erec's "Cargo Grid Reference Guide" (an isometric sheet of every vehicle's grids, on the RSI Community Hub); and, for every ship with a hangar or a vehicle bay, which ships and ground vehicles fit inside it, as Pegaxsus's "Ship Fitting List" on r/starcitizen records per patch (rows of vehicles against columns of carriers, with fits, tight fits and failures marked).

What the records hold:

- The vehicle's `cargo_grids` (`VehicleStats.raw`, as the Wiki API serves it): each grid's width, height and length in metres, its SCU, whether it is open to space, and the largest box it takes. 119 of the pack's 253 ships have grids, 410 in all; every grid's volume is its SCU times 1.25 m cubed, so the SCU cell is 1.25 m on every ship; the grids' SCU sum to the ship's cargo figure on every ship. The record's `cargo_limits` repeats the largest box; its `min_size` and `max_size` triples are per-axis caps whose axes do not follow the grid's own, so they are not read.
- The cargo items (`/api/items?filter[type]=Cargo`): 1,475 commodity container records for the build, 1,294 of them named for a size (`…_16SCU_…`) with cargo dimensions; they agree on seven shapes: 1 SCU 1.25 m cubed; 2 SCU 1.25 × 1.25 × 2.5 m; 4 SCU 2.5 × 1.25 × 2.5; 8 SCU 2.5 cubed; 16, 24 and 32 SCU 2.5 × 2.5 by 5, 7.5 and 10 m long. One record named for 4 SCU is a corpse container of another shape.
- Nothing in any record says what fits in a hangar or a vehicle bay: no bay dimensions, no door sizes. The fitting list is tested in play by its author, patch by patch, and kept in a Google Sheet.

CLAUDE.md section 2: every stat comes from the pipeline and nothing is hand-entered; a chat instruction that conflicts with the file is said so and asked about. It was, and the owner decided.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The section | A tenth numbered section, "Cargo", after Crew and operations, on every ship file; a ship whose record lists no grid says so (and what the record states in SCU, if anything), a concept ship says the data is not in the game yet | The same sections for every ship (ADR-012) |
| The facts | Capacity (the grids' SCU), the grids (count, SCU and dimensions, identical grids counted together), the largest box the record says the ship takes, and which grids are open to space | The record's own figures |
| The figure | "Fig. D": each grid as a wire box in cells of one SCU, seen from a corner, in ink on the page's paper (ADR-020), holding boxes of one standard size chosen from a picker; a line per grid saying how many stand and how; a table of every size against every grid; the caption naming the rule and what is not modelled | The owner's example as a drawing from the records, nothing copied from the guide; one accent, ink and paper, like the holomodel and the damage path |
| The arithmetic | `fitOf` in `apps/web/lib/cargo.ts`: boxes upright, in rows across the width and along the length, in as many layers as the height takes, turned a quarter on the floor where that holds more, and only sizes between the smallest and largest box the record names for the grid. One floor division per axis, tested on the pack | A count anyone can check against the drawing; no packing search, no guess at the game's placement |
| What is not modelled, and said so | The game's own placement, mixed loads of several sizes, doors and loading access, and anything tested in play | A reader must not take the drawing for a loading plan; the caption lists them |
| The box shapes | `fixtures/cargo/CargoBox.json`, one row per size, read from the cargo item records by `scripts/bootstrap-fixtures/cargo-boxes.ts` (eight requests through the bootstrap's rate-limited client); a record named for a size whose volume is not that size is left out and counted; two standard shapes for one size halt the run. The daily refresh runs the script after a rebuild, or when the file is missing or for another build | The shapes are game data and come from records, not from a guide or memory; the pipeline's Phase 1 normalizer takes the step over when it reads containers from the game files |
| The fitting list | Decided, not yet built: the ship file will show, for a carrier, the vehicles that fit it, and for a vehicle, the ships that carry it, from Pegaxsus's list, copied by script from its spreadsheet into `fixtures/fitting/`, never typed in. It is community-tested data and is labelled as such on the page with its author, its patch and a link, never as a game stat, and it is shown only once the author has agreed to the reuse, as with UEX's prices (ADR-013). The owner validated the list's measurements in play and accepted it over section 2's rule for this one source, recorded here as the exception | The owner's decision, the only source there is, and the work of one person whose consent and credit the project owes |

## Consequences

- `packages/schema` gains `CargoBox` and `CargoBoxes`; `fixtures/cargo/` holds the shapes and the script's sample; `apps/web/lib/cargo.ts` and `showcase/cargo-grids.tsx` draw the section; the refresh gains the `cargo-boxes` step.
- The particulars' Cargo row and the Crew and operations fact are unchanged; the compare page is unchanged.
- The fitting list follows in its own PR once the owner sends the spreadsheet's address and the author's answer: the script, the fixture, the two lists on the ship file, and a spec 02 criterion ticked then.
- Deferred: a 24 SCU box is in the shapes but no grid in the pack names 24 as its largest box, so it appears in the table and the picker and stands where the record allows a 32; the grids' `min_size` and `max_size` caps are not read until their axes are understood; the vehicle's own inventory (`vehicle_inventory`, `inventory_containers`) is not shown, its unit being unstated in the record.
