# ADR-040: The ledger folded into the front page; the funding page removed

- Status: accepted; amended 2026-11-11 (citizens on the card)
- Date: 2026-11-10
- Deciders: owner ("The funding module on the main page is perfect - we can deprecate and remove the dedicated funding page", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-018 (the page), ADR-038 (the card's link to the ledger), ADR-020's ledger row in system.md, spec 02's Funding criterion, spec 06's ledger criteria, `docs/legal/attribution.md`

## Context

ADR-018 built the funding page: the figure strip, the running total since 2012, year bars, the month grid, this year against the last two, the trailing-year trend, the daily rate, a citizens measure as URL state, and a Sources section. ADR-038 put one funding card on the front page: this year so far, the share of last year's total, the same-days change, and a toggle between this year against last year and month by month. The owner found the card enough and asked for the page to go.

What goes with the page and is not carried to the home: the citizens measure (its counter on the front page stays), the running total since 2012 with the first-billion mark, the year bars, the month grid with the long-gap note and the table of every month, the trailing-year trend, the daily rate since 2012, and the Sources section's account of RSI's own corrections and the dropped row. The data (`fixtures/funding/Funding.json`, the daily fetch, ADR-023) and the measures that compute the card stand.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The page | `apps/web/app/funding/` is removed with its page, its running-total chart and the charts the card does not draw; `/funding` redirects permanently to `/#funding`, the card's anchor, since the address has been public since ADR-018 and in the sitemap (the measure address lands on `/?measure=citizens#funding`, Next keeping the query, which the home ignores) | The owner's call; a published address lands somewhere |
| The card | The front page's "Funding this year" section is the site's one funding surface: the three figures, the two views (ADR-038), and under them the ledger's sources line (RSI's counter via the Star Citizen Wiki API, the copy date, differences between snapshots, never estimated). The running head carries the latest reading's date in place of the link to the ledger | What the page said about its numbers, the card now says |
| The counters | "Pledged since 2012" and "This year" in the figure strip link to the card (`#funding`); "Citizens" links nowhere, since the site no longer draws citizens | No link to a page that is gone |
| The nav and contents | "Funding" leaves the shell's sections and the front page's contents, which renumber to five | |
| The library | `apps/web/lib/funding.ts` keeps what the card draws (`readings`, `readingAt`, `yearRows`, `headline`, `yearPaths`, `yearAgainstLastYear`, `monthPairs`, the formatting); the page's own measures (`parseMeasure`, `fundingHref`, `trailingTrend`, `dailyRate`, `totalSegments`, `firstCrossing`, `declines`, `gapTotal`) go with the page and their tests with them; `Frame`, `YearVsYear` and the scale helpers move to `apps/web/app/funding-charts.tsx` | No dead code kept for a page that may not return; git has it |
| Credits | Sycend's idea credit stays on the about page (`FUNDING_INSPIRATION`, reworded from "this page" to "the site's funding figures"); the wiki's credit is in every footer and in the card's sources line; `attribution.md`'s row says so | The obligations stand where the figures are shown |
| Tests and budgets | `e2e/funding.spec.ts` and the funding records go; `screens.spec`, `legal.spec` and `lighthouserc.json` lose the route; `theme.spec` uses the titles page for its second page; `home.spec` checks the redirect, the counters' anchors and the nav | |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the page and link it from the card | The owner asked for it removed |
| Keep the charts' code for a possible return | Dead code; the history is in git (ADR-018's PR) |
| A 404 for `/funding` | The address was published and indexed; a redirect keeps it useful |

## Consequences

- The site has four sections in its nav: Ships, Components, Titles, News.
- The citizens counter and the history since 2012 are no longer drawn anywhere; a reader who wants them has RSI's page and the wiki's API, both linked.
- The funding fixture is still fetched daily (ADR-023) and read by the front page alone; `next.config.ts` keeps tracing it.
- The home records change (the counters' notes and the sources line); the funding records are deleted.

## Amendment, 2026-11-11: citizens on the card

The owner asked for "a toggle with the same charts, but instead of money it shows citizens/players gained" (2026-11-11). The card now counts either measure: a second control, Pledges or Citizens, sits in one row with the view control (`FundingToggle`, `apps/web/app/funding-toggle.tsx`, which replaces `ViewToggle`), and switches the three figures and both drawings to citizens registered: "Citizens gained in <year> so far", the share of last year's gain, the change on the same days, this year's running gain against last year's and each month's gain beside last year's. The view is kept across a switch. The figures are the same ledger differences as the pledges (ADR-018): the fixture already held RSI's citizens counter for every day (`readings(series, "citizens")`), so no data changed. The "Citizens" counter in the figure strip links to the card again. The two controls now sit above the figures rather than below them (ADR-038 drew the view control under the figure strip); on a phone they wrap onto two rows. A reader without script sees the pledges' year to date, as before; the Citizens counter's link lands on the card as it opens, on pledges. Citizens are "citizens registered", RSI's count of accounts, not players who play; the card says citizens.
