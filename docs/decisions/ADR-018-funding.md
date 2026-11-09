# ADR-018: Funding: RSI's pledge and citizen counters, by month and year

- Status: accepted
- Date: 2026-11-08
- Deciders: owner (asked for the page, chose "Wiki API only" for the data on 2026-11-08, and "everything in one master version"), Claude Code session 2026-11-08

## Context

The owner asked for a page on the growth of Star Citizen's crowdfunding "with the same data granularity and quality" as Sycend's [Star Citizen Funding Dashboard](https://public.tableau.com/app/profile/sycend/viz/StarCitizenFundingDashboard/IncomeView) on Tableau Public (money by year, stacked by month; year against year; a year-over-year trend; per-day spikes), "but much easier to read and much more beautifully designed", credited as needed.

What the sources offer, read on 2026-11-08:

- **RSI** publishes two running counters on robertsspaceindustries.com/funding-goals: money pledged and citizens registered. It publishes no history.
- **The Star Citizen Wiki API** (`/api/v2/stats`, already a credited source, CLAUDE.md section 9) records those counters once a day since 13 November 2012: 4,192 rows in 21 pages of 200. Holes: no rows from 25 January 2022 to 8 May 2024 (835 days), some single days, nine days with two rows, one row with a total of $0 (9 June 2021), and a stretch in November and December 2019 where RSI lowered the counter by a few percent before putting it back. Citizen counts start on 19 August 2013; earlier rows hold 0.
- **Sycend's workbook** has data downloads switched off (`allowDataAccess: false` in its public metadata), so its data is not available and is not used. Its data runs hourly and has no 2022-23 hole; the owner chose not to ask for it.

The design system allows one accent colour (CLAUDE.md section 7), so Sycend's twelve-colour month stack is not an option.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Entity | `FundingSnapshot` and `FundingSeries` in `packages/schema/entities/funding.ts`, outside the data pack like `Title` (ADR-017): one row per UTC day with the cumulative total and the citizen count, plus a source block with the fetch time, the gaps and the dropped rows. `fixtures/funding/Funding.json` (about 600 KB) | Not game data; Zod still guards the boundary. The totals are RSI's; everything shown is a difference between two of them |
| Fetching | `scripts/funding/fetch.ts`: 21 requests through the bootstrap's rate-limited wiki client (30 a minute at most) with the shared `userAgent("funding")`. Each row is validated against the exact shape seen (`WikiStatsRow`, strict); anything else halts the run. The first page is committed as the mapper's test sample | CLAUDE.md section 5: halt on unknown shapes; section 9 limits |
| Mapping | Two rows on one day: the later wins. Citizens 0 before 19 August 2013: null, not zero. A row whose total is below half the previous kept one is dropped and listed in `source.dropped` (one row, 9 June 2021, $0); a citizen count below half the previous one becomes null on its own, the money reading that day kept. RSI's own corrections of a few percent stay | A cumulative total cannot fall to a fraction; a few percent can, and did. Dropping by a stated rule is validation, not hand-editing |
| Periods | A month or year is reported only when a snapshot exists within three days of both its ends (`TOLERANCE_DAYS`); otherwise it is "unknown" and the grid shows a dot. The first period is counted from the first snapshot, so the $3.4M raised before tracking began is in no month. The current period runs to the latest snapshot and is marked "so far" | Never estimate. The 2022-23 hole makes 2022, 2023 and 2024 yearly totals unknown; the page states the stretch's total in one sentence instead |
| Headline figures | Total; this calendar year to date against the same days of last year (the same calendar date a year earlier, 29 February reading 28 February); the last 365 days against the 365 before; the last 30 days. The Sources section derives from the series the days on which the counter read lower than the day before, rather than naming them by hand | Sycend's "annual change YoY" is the trailing-365 comparison; the calendar-year one is what people ask first |
| Charts | Year bars (the amount added, the change on the year before); the month grid shaded by one hue, the accent's tint in five steps by share of the largest month; this year against the last two as running totals by day of year; the trailing-year trend line; the daily rate since 2012. Server-rendered SVG with `vectorEffect="non-scaling-stroke"` inside a `viewBox`, every label HTML in text tokens so nothing scales down on a phone; every mark carries a `<title>`; a table of every month sits under the grid. On phones the grid becomes one block per year (system.md: no table scrolls sideways) | One accent: the current year and single series in the accent, earlier years in `text.primary` and `text.muted` with a dash as the second cue (dataviz: never colour alone). Two measures of different scale get two charts, never two axes |
| Measure | `?measure=citizens` switches every figure and chart to citizens through a `SegmentedLinks` control; anything else is pledges | URL state, like every filter on the site |
| Credit | The Star Citizen Wiki API credit is already in every footer; the page's Sources section names RSI's page, the API, the copy date, the rules above and the dropped row. Sycend is credited for the idea on the page and the about page (`FUNDING_INSPIRATION`), stating that none of their data is used | Attribution for the measures the page copies; no data taken |
| Folders | `scripts/funding/` and `fixtures/funding/` are new (CLAUDE.md section 4) | |

### Sizes (CLAUDE.md section 2, "no spacing value outside the tokens")

The plot area has no height token; its shape is an aspect ratio, 2:1 on phones and 3:1 from the `md` breakpoint (`aspect-[2/1] md:aspect-[3/1]`), and every other size on the page is a spacing token. The month tints are the accent at 10, 20, 35, 50 and 70 percent opacity; the current year's bar at 50. No other value is added.

### Deferred (from the audit of PR 11)

- A series ending exactly on 31 December is still "so far" until the first reading of the new year; the new year has no path of its own until it has two readings.
- The API pages newest first, so a row added mid-run shifts the pages by one; the mapper's one-row-per-day rule absorbs a duplicate, and a skipped day shows as a one-day gap on the next run.
- A genuine rebase of RSI's counter (a fall of more than half) would drop every later row; the fetch summary's `dropped` count would show it.
- On phones the exact-figures table is left out; the per-year blocks carry compact values.
- The fetch overwrites `Funding.json` in place, like every fixture; the "new version" rule is for published data packs.

## Not decided (the owner's)

- **Asking Sycend for their hourly data** to fill 2022-23. Declined for now ("Wiki API only").
- **A scheduled refresh.** The fetch script is run by hand; the counters move every day, so the page is as current as the last run. A weekly workflow like the loaner matrix's would fit.
- **Event annotations** (CitizenCon, Invictus, a concept sale) on the daily chart. They would be hand-entered (CLAUDE.md section 2); a sanctioned source would be the news feed, once it exists.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Sycend's Tableau data | Downloads off; the owner did not want to ask |
| Interpolate the 2022-23 hole | An estimate shown as data |
| Twelve month colours | One accent (CLAUDE.md section 7); the grid carries month identity by position |
| A dual-axis chart of money and citizens | Never two y-scales; the measure switch gives each its own charts |
| Drop RSI's November 2019 corrections too | They are what RSI published; only the impossible row goes |

## Consequences

- Schema additions: `FundingSnapshot`, `FundingSeries`.
- Nav gains Funding (five sections; the phone header row from ADR-017 fits them).
- `docs/legal/attribution.md` gains the Sycend row; system.md section 4 the page's layout; spec 02 a "Funding" criterion.
- Unit tests cover the mapper on the committed sample and the page's numbers on the fixture and on synthetic series (tolerance, partial periods, the first period, the trailing comparison); e2e covers the page, the measure switch, the phone width and the footer.
