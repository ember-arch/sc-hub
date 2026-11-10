# ADR-032: Periwinkle for the accent, Spectrum's yellow for a developer post

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("for spectrum posts, let's do them in CIG's trademark yellow; let's also make the posts prettier and beautifully designed; for the other color accents on the site, let's use a periwinkle (slightly more in the blue spectrum than purple), rather than the burnt orange we have been using", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-021 (the accent), system.md section 2 (the colour table) and section 3 (`DevPost`)

## Context

The accent was the almanac's oxblood (`#B8381F` by day, `#EE7A5F` by night, ADR-020 and ADR-021): links, focus, the selected chip and tab, the current year in the ledger, the page's own ship in the lineup. The owner wants it periwinkle, on the blue side of the blue-to-purple range. One accent stays the rule (CLAUDE.md section 7).

A developer post was a plain card: name, role, thread, time, the text, the link. On Spectrum itself a staff post is marked in yellow: the role's own colour, `DEC342`, which the identify call names for the staff role (ADR-027), the one every reader of Spectrum knows as CIG's. The owner wants the posts in that yellow, and prettier.

The owner also asked, if it can be done, for the pictures in posts. The search answer the worker reads (ADR-027) carries a post's text and nothing of its pictures; a post's own page would, at one request every five minutes per endpoint (CLAUDE.md section 9), which for 518 posts on record is forty-three hours and for every new post a wait of its own, and every picture would be CIG's imagery to copy locally like the rest (ADR-009). Not done; the ADR records why.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The accent | `#4A5AD3` by day (5.17:1 on the wall, 5.68:1 on a card, 4.69:1 on an inset well), `#98A4F4` by night (7.78:1, 7.11:1, 6.53:1, 6.46:1); the tint `accent.bg` `#E3E6FA` and `#2A2E4A`, on which primary and secondary text read at 14.2:1 and 5.75:1 by day, 11.4:1 and 6.17:1 by night. The contrast test keeps every pair at 4.5:1 or more | The owner's hue, at the darkness the wall needs by day and the lightness the charcoal needs by night; the lighter periwinkles the eye expects fail 4.5:1 on paper |
| Spectrum's yellow | A new token, `spectrum.staff`, `#DEC342` in both schemes: Spectrum's own colour for the staff role, read from its identify answer, not chosen. It marks and is never text: a 3 px rule down a developer post's left edge and the ring of the role tag. At 1.75:1 on white it could not carry text by day; by night it reads at 9.5:1 but stays a mark so the post looks the same in both | The owner's "CIG's trademark yellow" is what Spectrum paints a staff post with; a mark in it says "a developer wrote this" the way Spectrum does |
| The post | `DevPost`: the card keeps its tone and soft shadow and gains the yellow rule; the author's name leads in medium ink (a link to the author page, underlined like every link, ADR-005: a link is never told by colour alone), the role in a yellow-ringed tag in the label size, the thread in secondary, the time at the right; the post as prose at the reading measure with more room on wide screens; the Spectrum link last, always visible (obligations.md) | Prettier by hierarchy and air, not ornament; no emoji, glow or gradient (CLAUDE.md section 2) |
| One accent | Unchanged: the yellow is a mark for one kind of content, like a status colour is for a state; it is used on nothing else | CLAUDE.md section 7 |
| Pictures in posts | Not now, for the reasons in Context; a later ADR if the rate limits or a CIG feed change the arithmetic | |

## Alternatives considered

| Option | Why not |
| --- | --- |
| A yellow filled tag with ink on it | The ink token is cream by night and fails on yellow; a fixed dark ink would be a colour outside the tokens |
| Yellow text for the author's name | 1.75:1 on the light wall |
| A lighter periwinkle by day (`#5B6BE0`) | 4.13:1 on the wall, 3.75:1 on an inset well: links would fail the rule the tokens test enforces |
| Read each post's page for its pictures | One request every five minutes per endpoint: forty-three hours for the posts on record, and a wait for every new post |

## Consequences

- `packages/ui/tokens.ts`: the accent and its tint change in both schemes; `spectrum.staff` joins the colour tokens (utility `spectrum-staff`); `tokens.css` is regenerated. system.md's table and `DevPost` entry follow.
- Every screenshot record changes, since the accent is on every page; the gallery's stories too.
- The favicon (`apps/web/app/icon.svg`), a square in the accent (ADR-005), takes the periwinkle; it had kept an older blue.
- ADR-005's list of allowed arbitrary classes gains `border-l-[3px]`, the post's rule.
- Two tests keep the rules: `spectrum.staff` equals the staff role's colour in the committed identify sample (`fixtures/spectrum/samples/identify.sample.json`), so a change on Spectrum's side shows up when the sample is refreshed; and no component or page sets the yellow as text, a fill or a background.
- Left as noted by the audit: the gallery's `DevPost` story shows no role tag, since the schema fixture's author has no role; on a wide screen the post's prose keeps the reading measure and the card's right half stays empty, by design.
- Nothing else is repainted: the status colours, the ink, the surfaces and the scrim stay.
