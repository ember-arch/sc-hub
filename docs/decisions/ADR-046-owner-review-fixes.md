# ADR-046: The owner's review of 2026-11-11: the PTU slot, the ship count, built-in parts, the compare bar, the switch and the phone home page

- Status: accepted
- Date: 2026-11-11
- Deciders: owner (a pasted review of the live site, plus two notes on the theme switch and the home page on phones)
- Amends: spec 00 criterion "Patch strip" (PTU shown only when recorded), ADR-007 (the strip), ADR-020 (the parts index), the home page of ADR-038

## Context

The owner reviewed coppercork.com and listed what read wrong:

1. Every page's footer said "PTU: no build recorded", while the home page's dev posts showed CIG's 4.10.3 PTU patch notes. "Either load PTU data or hide the badge."
2. The ship counts disagreed. The home page said 260 ships, "231 flight ready · 28 in concept", which adds to 259. The ships index said "232 ships · 28 in concept", which reads as if the concepts were among the 232.
3. Thrusters (1,083) and fuel intakes (156) are over 40% of the 2,909 parts, and players do not swap them. "Hide them by default."
4. The Golem showed "Not on file" for its in-game price and shops.
5. The Compare button on the ships index did not say what it does.
6. In dark mode the theme switch's knob sat outside its capsule.
7. On phones the home page's contents list stacked above the dispatches and pushed them off the first screen.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The PTU slot | The patch strip always shows LIVE, empty state included, and shows PTU only when the pack records a PTU build | The Wiki API serves LIVE builds only, and PTU numbers need the Phase 1 pipeline on the owner's PC (spec 01). A slot saying "no build recorded" beside CIG's PTU patch notes read as a fault. The slot comes back by itself once a PTU build is recorded |
| The ship count | One count, `shipTally` in `apps/web/lib/ship-count.ts`, for both pages: the register's entries plus RSI's concept ships, with every status named so the parts add up. Today: 260 ships, 231 flight ready, 29 in concept. The index's filtered count reads "N of 260 ships" (concepts a search finds included), and the tally stands only beside the whole count. A status filter leaves RSI's concepts out, as every facet does (ADR-010), so "Concept" lists the Javelin alone | The missing ship was the Javelin, a concept in the game data. The old note counted only RSI's 28 concepts |
| Built-in parts | `FIXED_TYPES` (thruster, fuel intake) are left out of the parts index unless `?fixed=shown`. A line under the filters says how many there are under the current filters and links to show or hide them, and the filters keep the choice. The home page counts the parts people fit, with the built-in ones noted beside it. Each part's own page and the search still reach them | The owner's call. Fuel tanks (314) and armour (189) are not swapped either; they stay listed until the owner says otherwise, and adding them is one line |
| The Golem's prices | No code change. UEX reports 5 shops and 20 rental counters for the Golem on the current build, but the price file had not landed since PR 9. The refresh was halting on RSI's $0 rows (issue 34, PR 61); with that fixed, the refresh of 2026-11-11 (commit 11dbd0e) filled it: 631 shop prices, up from 35, and the Golem page lists its shops and rental counters | The data was there; the pipeline was stuck |
| Compare | The button reads "Add to compare" ("In compare" once added). Its spoken name is that label plus the ship (WCAG 2.5.3). On the ships index, while the basket holds a ship, a bar sticks to the foot of the screen: it says how many are picked (announced as it changes), links to the side-by-side page ("See them side by side") and clears the picks, returning focus to the heading. It is the last thing in the main column, so at the end of the page it docks above the footer instead of covering it. The masthead keeps its "Compare 2 ships" link, the near one for the keyboard; the ship page keeps its link beside the button | The side-by-side page existed, but its link sat in the page's heading, off screen once a card was tapped |
| The switch | The knob is pinned 4 px inside the left end (light) or the right end (dark) | It had no left anchor, so the button's centred content started it at the middle, and the dark shift carried it 8 px past the right end |
| The contents on phones | The home page's contents list shows from tablet width (`md`) up | On a phone it filled the first screen. The header's section pills already link the same pages |

## Consequences

- The legal e2e checks that the PTU slot is absent while the pack has no PTU build; a unit test of `PatchStrip` checks that it shows a recorded PTU build.
- The ships-index e2e counts RSI's concept ships in the register's total.
- Unit tests cover `shipTally` (the parts add up, on the pack too) and the built-in parts (only those two types are left out; `?fixed=shown` lists them, and the index links keep it).
