# fixtures/funding

RSI's public counters of money pledged and citizens registered, one snapshot a day from 13 November 2012 to the day of the last fetch, as the Star Citizen Wiki API records them from robertsspaceindustries.com/funding-goals (ADR-018), and the latest reading of those counters from RSI itself (ADR-018, amended 2026-11-13). Not game data. Nothing here is written by hand.

| File | What it is |
| --- | --- |
| `Funding.json` | `FundingSeries`: the source, the days the API has no snapshot for (longest first), and every snapshot ascending by day. Totals are cumulative; the page computes months, years and comparisons from differences. |
| `samples/stats-page-1.json` | The API's first page of 200 rows, as served, for the mapper's unit tests. |
| `Counter.json` | `FundingCounter`: RSI's two counters as RSI's funding page reads them, the latest reading with its time, and the last reading of an earlier UTC day, which stands for the day the wiki has recorded but the daily refresh has not copied yet. The News workflow rewrites it about once an hour; the front page puts it after the snapshots when it is newer than the last of them. |
| `samples/crowdfund-stats.json` | The answer of RSI's counter endpoint, as served, for the counter's unit tests. |

Known holes, kept as they are: no snapshots from 25 January 2022 to 8 May 2024, and the counter fell for a few days in November and December 2019 before RSI corrected it. The page shows a month or year only when a snapshot exists within three days of both its ends.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/funding/fetch.ts
```

About 21 requests through the bootstrap's rate-limited client (30 a minute at most). A row of an unknown shape halts the run and nothing is written.

`Counter.json` comes from the News workflow; by hand:

```
pnpm --filter schema build && SC_HUB_CONTACT_EMAIL=… pnpm exec tsx scripts/funding/counter.ts [--when-due] [--save-sample]
```

One request to RSI. An answer of an unknown shape, or a reading below half the latest snapshot's, halts the run and nothing is written.
