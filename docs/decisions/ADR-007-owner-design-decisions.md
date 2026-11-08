# ADR-007: Owner design decisions after the spec 02 design review

- Status: accepted
- Date: 2026-11-07
- Deciders: owner ("just run with it", 2026-11-07, on the recommendations listed after the spec 02 design review), Claude Code session 2026-11-07

## Context

The spec 02 design review (ADR-006, section "Design review") left decisions that are the owner's: token values, wording in the design rules and the spec, and which repeated or empty elements a page keeps. The owner accepted the recommended option for each on 2026-11-07. Three items stay open because only the owner can act on them: downloading the fankit, choosing the contact email, and the project name and domain (CLAUDE.md section 12).

## Decision

### Colors (`packages/ui/tokens.ts`, system.md section 2)

Every color used for text now reads at 4.5:1 or more on every background (`bg.page`, `bg.surface`, `bg.raised`, `bg.inset`) in both schemes. A unit test in `packages/ui/__tests__/tokens.test.ts` checks every pair, so a later token change cannot break the rule unnoticed.

| Token | Scheme | Was | Now | Worst case before | Worst case now |
| --- | --- | --- | --- | --- | --- |
| `accent` | light | `#2F6BFF` | `#2560E8` | 3.90:1 on inset | 4.65:1 on inset |
| `success` | light | `#1F8A4C` | `#1A7A43` | 3.80:1 on inset | 4.66:1 on inset |
| `warning` | light | `#B86E00` | `#9A5B00` | 3.46:1 on inset | 4.71:1 on inset |
| `text.muted` | light | `#8A8E96` | `#696D74` | 2.85:1 on inset | 4.51:1 on inset |
| `text.muted` | dark | `#6E7279` | `#82868E` | 3.46:1 on raised | 4.58:1 on raised |

The dark accent, success, warning and danger, the light danger (4.59:1 on inset), and both schemes' primary and secondary text already passed and are unchanged. The favicon (`apps/web/app/icon.svg`, ADR-005) follows the light accent. `text.muted` now passes too, which settles the ADR-005 question of whether to darken it: it is darkened, and it may be used for real text again, not only placeholders. Local Lighthouse runs missed the light-mode failures because the machine's system scheme is dark; the unit test does not depend on that.

### Design rules (CLAUDE.md section 7, system.md sections 1 and 2)

| Rule | Was | Now | Reason |
| --- | --- | --- | --- |
| Type sizes | "Three sizes per page" | "At most three sizes per page besides interface text (`ui`) and captions" | The six-role type table (ADR-005's open question) and the rule now agree; every page already meets the new wording |
| Capitals | "No all-caps labels except unit abbreviations" | "...except unit abbreviations and the game's own acronyms (SCM, NAV, EM, IR, LIVE, PTU, EPTU)" | They are the words players read in the game and search for |

### Pages

| Decision | Change |
| --- | --- |
| Ship key facts no longer repeat the hero | Manufacturer and status leave the key-facts block; the hero already shows the manufacturer above the name and the status badge beside it. Key facts are role, size, crew, cargo, length and mass. The four stats that also appear in the specifications stay in both, because the specifications are where their PTU differences show. Compare keeps manufacturer and status in its key facts, since it has no hero per ship |
| Empty sections stay out of the page | "Variants and paints" renders only when the ship has a variant or a paint; "Changed in this version" waits for spec 01's `diff.json` and a second version, and is built then (tracked in spec 01's notes). This reverses ADR-006's choice to show them as empty states. Sections whose data the pack always has (specifications, hardpoints) keep their empty states for a ship that lacks it |
| One patch strip per page | The home page drops its "Current builds" section; the footer strip is on every page, home included, so spec 00's "on home and in the footer" still holds |
| The footer line "SC Hub is a non-commercial fan project." | Kept; it is a plain signal to CIG |
| The manufacturer page's 3 px rule | Drawn in the `border.strong` token until the fankit supplies brand colors; spec 02's "Manufacturer pages" criterion is ticked on that basis |
| Wide tables between phone and desktop | Found while the owner looked at the site in an 800 px window: the eleven-column ships table scrolled sideways from 768 px until about 1200 px. `DataTable` takes `expandBelow` (`md` by default, `lg` or `xl`); the ships table uses `xl`, so it keeps the expand-row layout until all columns fit. Wherever a sortable column is hidden, a "Sort by" select above the table offers every column in both directions, so the spec's "sort by any stat column in table mode" holds at every width, phones included. An e2e checks for sideways scroll at 820, 1024 and 1180 px |
| The three criteria ticked with caveats in ADR-006 (308 instead of 301, "changed in this version" without `diff.json`, the PTU toggle on synthetic rows) | Confirmed as ticked |

## Still the owner's

- Download the fankit into `fixtures/fankit/` (spec 00 prerequisite). It fills the ship-page image slot and card images, which are empty today. The fankit is licensed, so the download is the owner's.
- Choose the contact address for corrections and takedowns (`CONTACT_EMAIL` in `packages/ui/legal.ts`).
- The project name, and with it the domain for `SITE_URL` (CLAUDE.md section 12).

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the accent and use a darker color only for links | Two blues breaks the one-accent rule; the darker accent reads the same at a glance |
| Hide the empty ship image slot until the fankit arrives | The owner chose to fill it with the fankit instead; the slot stays as the spec's placeholder until then |
| Leave `text.muted` failing and placeholder-only | Placeholder text is still text a reader has to read |

## Consequences

- Every page's links, badges and focus rings are slightly deeper blue, green and amber in light mode; dark mode is unchanged except for the muted grey.
- The tokens test fails on any color pair under 4.5:1.
- The palette's placeholder and any future caption in `text.muted` pass contrast.
