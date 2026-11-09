# fixtures/funding

RSI's public counters of money pledged and citizens registered, one snapshot a day from 13 November 2012 to the day of the last fetch, as the Star Citizen Wiki API records them from robertsspaceindustries.com/funding-goals (ADR-018). Not game data. Nothing here is written by hand.

| File | What it is |
| --- | --- |
| `Funding.json` | `FundingSeries`: the source, the days the API has no snapshot for (longest first), and every snapshot ascending by day. Totals are cumulative; the page computes months, years and comparisons from differences. |
| `samples/stats-page-1.json` | The API's first page of 200 rows, as served, for the mapper's unit tests. |

Known holes, kept as they are: no snapshots from 25 January 2022 to 8 May 2024, and the counter fell for a few days in November and December 2019 before RSI corrected it. The page shows a month or year only when a snapshot exists within three days of both its ends.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/funding/fetch.ts
```

About 21 requests through the bootstrap's rate-limited client (30 a minute at most). A row of an unknown shape halts the run and nothing is written.
