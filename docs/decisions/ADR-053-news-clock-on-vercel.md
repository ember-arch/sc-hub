# ADR-053: A clock on Vercel starts the News workflow; its own schedule is the backup

- Status: accepted; the clock does nothing until the owner adds `NEWS_DISPATCH_TOKEN` to the Vercel project
- Date: 2026-11-12
- Deciders: owner ("Vercel cron", 2026-11-12, after asking why the scheduled news runs kept being skipped), Claude Code session 2026-11-12
- Amends: ADR-027 (who starts the pollers), CLAUDE.md section 9

## Context

The News workflow is meant to run every thirty minutes (ADR-027, amended 2026-11-11). GitHub's scheduler is best effort and drops scheduled runs when its queues are busy. After the half-hourly schedule merged at 20:53 UTC on 11 November, about nineteen runs were due by 06:00 UTC on 12 November and two ran (03:17 and 03:45). Nothing in the workflow held them back: the concurrency group does not cancel, and hand-started runs began at once. GitHub's status page recorded an incident across Actions that afternoon. The daily refresh, on its own schedule, ran eight hours late the same day. A Comm-Link or developer post could wait hours to reach the site.

A run started through the workflow-dispatch API is not subject to the scheduler; it starts at once.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The clock | A Vercel cron job (`apps/web/vercel.json`, `7,37 * * * *`, production only) calls `/api/cron/news`, which starts `news.yml` on `main` through `POST /repos/ember-arch/sc-hub/actions/workflows/news.yml/dispatches` | The project is on Vercel Pro, whose cron runs to the minute at no extra cost; the pollers stay where they are until Fly (spec 03) |
| Credentials | `CRON_SECRET` (Vercel sends it as a bearer token; the route refuses every call without it, compared in constant time) and `NEWS_DISPATCH_TOKEN`, a fine-grained GitHub token for this repository alone with Actions read and write and no other permission, both on the Vercel project only. Without the token the route answers and does nothing | The token can start and read this repository's workflow runs and nothing else; the runs themselves use the workflow's own `GITHUB_TOKEN` as before |
| No doubled runs | The route starts nothing while a run of the workflow is queued or under way, nor within six minutes of the last run ending (`decideNewsClock`, `packages/schema/news-clock.ts`). The workflow's schedules stay, and its new `gate` job makes a scheduled run stand aside when a dispatched run began under an hour ago; a failed look runs the news | Spectrum's search is asked at most once every five minutes (ADR-027). An hour after the clock last started a run, the schedule runs the news by itself again, so a broken clock costs at most an hour |
| The video slot | The clock sends `video_slot: due` in the first half of the hour, which the poll reads as the :07 schedule (ADR-050) | One YouTube feed an hour, as before |
| Visibility | One JSON line per call in Vercel's logs (`job: "news-clock"`); a GitHub refusal or a network failure answers 502 | A failing clock shows in Vercel's cron view |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Leave it to GitHub's schedule | Two of nineteen runs |
| Each run dispatches the next behind an environment's wait timer | No new token, but a repository setting, a chain that can multiply or break, and still GitHub's timers |
| A scheduled task on the owner's PC | Runs only while the PC is on; it was off for hours on 12 November |
| Move the pollers to Fly now | Spec 03's plan, but a new account and runtime for a scheduling fault |

## Consequences

- The owner creates the token on GitHub and adds it to the Vercel project as `NEWS_DISPATCH_TOKEN` (production); the next production deploy picks it up. It expires on the date chosen when it was made, and the clock then answers 502 until it is replaced, while the schedule takes over.
- Runs started by the clock show in Actions as `workflow_dispatch`, by the token's owner.
- Spec 03's fifteen-minute gate still waits for Fly.
