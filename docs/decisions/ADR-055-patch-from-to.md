# ADR-055: The patch pages read From → To

- Status: accepted; first numbered ADR-053, which the news clock's record (ADR-053-news-clock-on-vercel) also took; renumbered 2026-11-12
- Date: 2026-11-12
- Deciders: owner ("on the patch page, it's difficult to really understand the 'from' 'to'; more beautifully designed with clear from/two; think the way you'd brief or show it to a design-focused executive")
- Amends: ADR-049 (the patch pages' head, tables and folded lines; its "newest first" head and its fixed four-column table are replaced)

## Context

ADR-049's patch pages compare two builds. Three places made the direction hard to read:

- The head put the newer build first and the older second, with "against, 23 days earlier" between them, so it read right to left.
- The tables headed their value columns with bare build numbers ("4.10.1", "4.10.2"), so nothing said which was before.
- The folded line wrote "Loadout mass 770 → 820 (+6.5%)" in one run of text.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The head | A panel: **From** on the left, in secondary ink; **To** on the right, in primary ink. Each has its date and build string. The names are regular, `heading` on a phone and `title` from `sm`, and a hotfix's number may wrap. A line runs between them carrying the days apart ("23 days later") and ends in the tables' → in secondary ink. On a phone the arrow alone sits between, with the days on a line below. A backwards comparison says "then"; with no date the line carries no words | Reading order is time order; the build the page is about carries the weight |
| The table | Figure, Before, an arrow, After, Change, and from `sm` the bar: six columns where ADR-049 had four. On a phone the change pill stacks its amount over its share, and a build in a head may wrap, so a table fits its fold. The loadout has Port, Before, the arrow, After, and from `sm` a Change column (Fitted, Swapped, Removed). A changed recipe gets the arrow too | Every opened table fits 390 px, checked by e2e with every fold open, the hotfix page included |
| Table heads | "Before" and "After" in words, each over its build | The words say the direction; the build is the detail |
| The pair | The old value muted and right-aligned against an arrow, the new value strong and left-aligned after it, so each pair reads as one: 684 → 734. A screen reader hears "684 to 734" | One glance per row |
| The change | A pill with the arrow, the amount and the share ("↑ 50 +7.3%"), in neutral ink: up is not better | ADR-049's neutral rule stands |
| The size of a change | From `sm` up, a small bar out from a centre line: right for up, left for down. Its length is the square root of the share, capped at a doubling, so a 1% change still shows. It is drawn in secondary ink; the accent stays for links, focus and selection. There is no bar for a figure that is a word, or that starts at zero, where a share means nothing | Bars from zero made a 7% change invisible; the square root keeps the order and makes small moves visible |
| The folded line | Each headline change as the old value muted, an arrow, the new one strong, and the share in a pill. The line wraps between changes, never inside a pair | The same grammar as the table |

## Consequences

- `patches.spec.ts` checks:
  - the head's order (From, then To), replacing ADR-049's "newest first";
  - the Before and After heads;
  - that with every fold open no table and no head is wider than a 390 px screen, on `/patches` and the hotfix page.

  Two of its earlier checks matched an entry's whole text instead of its line and never ran; they are fixed.
- The tables' styles stay in `globals.css` (`.patch-table`), from the tokens.
- The bars are decoration for the eye (`aria-hidden`, their column head too). The change cell carries the same facts in words for screen readers.
- Not changed here: on the hotfix page an entry's detail line with an unbroken class name already ran a closed page past 375 px before this change.
