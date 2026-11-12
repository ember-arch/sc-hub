# ADR-053: The patch pages read From → To

- Status: accepted
- Date: 2026-11-12
- Deciders: owner ("on the patch page, it's difficult to really understand the 'from' 'to'; more beautifully designed with clear from/two; think the way you'd brief or show it to a design-focused executive")
- Amends: ADR-049 (the patch pages' head, tables and folded lines)

## Context

ADR-049's patch pages compare two builds. Three places made the direction hard to read:

- The head put the newer build first and the older second, with "against, 23 days earlier" between them, so it read right to left.
- The tables headed their value columns with bare build numbers ("4.10.1", "4.10.2"), so nothing said which was before.
- The folded line wrote "Loadout mass 770 → 820 (+6.5%)" in one run of text.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The head | A panel: **From** on the left, the build quieter; **To** on the right, stronger, each with its date and build string. A line runs between them carrying the days apart ("23 days later") and ends in the arrow. On a phone the arrow alone sits between, with the days on a line below. A backwards comparison says "then" | Reading order is time order; the build the page is about carries the weight |
| Table heads | "Before" and "After" in words, each over its build | The words say the direction; the build is the detail |
| The pair | The old value muted and right-aligned against an arrow, the new value strong and left-aligned after it, so each pair reads as one: 684 → 734. The same in the loadout, with each port marked Fitted, Swapped or Removed | One glance per row |
| The change | A pill with the arrow, the amount and the share ("↑ 50 +7.3%"), in neutral ink: up is not better | ADR-049's neutral rule stands |
| The size of a change | From `sm` up, a small bar out from a centre line, right for up and left for down, its length the square root of the share (capped at a doubling), so a 1% change still shows. Not drawn for words, or from zero, where a share means nothing | Bars from zero made a 7% change invisible; the square root keeps order and makes small moves visible |
| The folded line | Each headline change as the old value muted, an arrow, the new one strong, the share in a pill | The same grammar as the table |

## Consequences

- `patches.spec.ts` checks the head's order (From, then To) and the Before and After heads.
- The tables' styles stay in `globals.css` (`.patch-table`), from the tokens.
- The bars are decoration for the eye (`aria-hidden`); the change cell carries the same facts in words for screen readers.
