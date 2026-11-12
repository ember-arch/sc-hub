# ADR-056: The Vercel clock starts the daily refresh too; its own schedule is the backup

- Status: accepted
- Date: 2026-11-12
- Deciders: owner ("Yes, do it", 2026-11-12, to moving the daily refresh onto the Vercel timer after the overnight audit found it starting hours late), Claude Code session 2026-11-12
- Amends: ADR-023 (who starts the refresh), ADR-053 (the clock's token starts a second workflow), CLAUDE.md section 9

## Context

The daily refresh is meant to start at 06:23 UTC (ADR-023). GitHub's scheduler is best effort. The scheduled runs started at 15:04 on 10 November, 14:35 on 11 November and 15:27 on 12 November, eight to nine hours late. Prices, loaners and funding figures therefore reached the site in the afternoon. The News workflow had the same fault and now starts from a Vercel cron job through the workflow-dispatch API (ADR-053). That has started every slot on time since 07:07 UTC on 12 November.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The clock | A second Vercel cron job (`apps/web/vercel.json`, `23 6 * * *`, production only) calls `/api/cron/refresh`. That route starts `refresh.yml` on `main` through `POST /repos/ember-arch/sc-hub/actions/workflows/refresh.yml/dispatches`, without `force_rebuild` | The same clock and API that already work for the news |
| Credentials | The news clock's `CRON_SECRET` and `NEWS_DISPATCH_TOKEN`, shared. The token is the fine-grained token for this repository with Actions read and write, so it can already start any of the repository's workflows. Nothing new is stored. Without the token the route answers and does nothing | No new secret for the owner to make; the token's reach is unchanged |
| No doubled runs | The route starts nothing while any refresh run is queued or under way, whether it was scheduled, dispatched or started by hand. It also starts nothing when a dispatched run that was not cancelled was created in the last twelve hours (`decideRefreshClock`, `packages/schema/refresh-clock.ts`). The workflow's schedule stays. A new `gate` job lets a scheduled run go only when no dispatched run (not cancelled) was created in the last twenty hours (`REFRESH_SCHEDULE_STANDS_ASIDE_MS`). When it cannot read the list, the scheduled run goes. A test checks the span, the job wiring and the shared schedule against the workflow and `vercel.json` | A refresh is thousands of requests to RSI and the wiki at their polite limits, so a second run on the same day only repeats them. A cron call delivered twice finds the first run queued. A late scheduled run arrives at most about sixteen hours after the clock's, inside the twenty. If the clock fails, the last dispatch is a day old and the schedule runs as before. Going when the list is unreadable trades a possible second refresh for never losing a day |
| Visibility | One JSON line per call in Vercel's logs (`job: "refresh-clock"`). A GitHub refusal or a network failure answers 502. A scheduled run that stands aside shows the gate's reason and a skipped refresh job | A failing clock shows in Vercel's cron view |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Leave it to GitHub's schedule | Eight to nine hours late on three days running |
| Move the schedule earlier to absorb the delay | The delay is not constant, and the schedule would still be best effort |
| A separate token for the refresh | No narrower token exists: Actions permissions are per repository, not per workflow |

## Consequences

- Nothing for the owner to set: the next production deploy registers the cron job. The first clock run is at 06:23 UTC the following day.
- Runs started by the clock show in Actions as `workflow_dispatch`, by the token's owner.
- A forced rebuild started by hand also counts as that day's run. The clock skips for twelve hours after one, and the schedule for twenty.
- When the token expires (2027-11-11, ADR-053), both clocks answer 502 and both schedules take over.
