# ADR-030: The quality gates run where they are a gate, and the build runs once

- Status: accepted (owner direction 2026-11-10, "yes optimize it"); refines CLAUDE.md section 6 without changing what it requires. Does **not** resolve the structural overage recorded under Consequences, which is an owner decision
- Date: 2026-11-10
- Deciders: owner, Claude Code session 2026-11-10

## Context

The owner had been receiving repeated "ember-arch's minutes are running out" notifications from GitHub and asked, while Coppercork was being decommissioned, whether disabling that project's scheduled job would stop them.

It would not. Coppercork's `Catalog refresh` was 98 billed minutes a month. This repository's CI is the consumer, and two facts about Actions billing drive everything below: it bills **per job**, and it **rounds every job up to the whole minute**, so a job costs a minute before it does any work.

Measured per CI run, from a twelve-run sample: Lighthouse 6 min, Playwright 5 min, `check` 4 min, "Detect which surfaces exist" **1 min for eleven seconds of work**. Sixteen billed minutes a run.

Run frequency is the part that matters most, and it is not what a thirty-day average suggests. The repository is four days old, so the window flatters it. Over the seven days to 10 November CI ran **142 times**, about twenty runs a day: roughly **610 runs a month at current velocity**, not the 140 a thirty-day count implies. At sixteen minutes that is near ten thousand billed minutes a month against a **2,000-minute** GitHub Free allowance.

There is no branch protection — the Free plan cannot enable it — so no status check is a required check, and moving a job cannot block a PR on a missing report.

## Decision

| Concern | Choice |
| --- | --- |
| The `detect` job | Removed. It tested for `apps/web/package.json` in eleven seconds and was billed a full minute for it, every run. `apps/web` exists, so the question is settled and its answer was always `true` |
| Where e2e and Lighthouse run | **Pull requests only.** CLAUDE.md section 6 frames Lighthouse as failing "a PR", and section 8 requires that "the PR has Playwright screenshots". A push to `main` is a PR that already passed both, so the second run proves nothing new |
| Docs-only changes | Skipped. A step inside `check` diffs the PR against its base and sets an `app` output that `e2e` and `lighthouse` gate on. The filter is a **deny** list — everything except `docs/**`, `spec/**` and `**/*.md` counts as app code — so a new source directory costs a run rather than slipping past an allow list nobody extended |
| Where that filter lives | Inside `check`, which runs anyway. A separate filter job would have cost the billed minute it was meant to save, which is the mistake `detect` made |
| The web build | Built **once**. `check` uploads `apps/web/.next` (excluding `.next/cache`, which comes from the Actions cache instead) and Lighthouse serves it. `lighthouserc.json` starts the site with `next start`, which needs the output, not a second compile of identical source |
| The Next.js build cache | Kept. `next/font/google` downloads the faces at build (ADR-020), so the cache earns its place |
| The Playwright browser | Cached at `~/.cache/ms-playwright`, keyed on `pnpm-lock.yaml`. The browser is a ~130 MB download whose version only moves when the lockfile does. Its OS libraries sit outside that directory, so a cache hit still runs `install-deps`, which is seconds rather than a download |
| `numberOfRuns` in `lighthouserc.json` | **Left at 3.** Cutting it to 1 would save time by making the measurement noisier, and section 6 treats the budgets as tests. Cost is not a reason to measure worse |

## Consequences

- Per-run cost falls from sixteen billed minutes to roughly nine on a code PR, four on a docs-only PR, and four on a push to `main`.
- **This does not bring the account inside its allowance, and nothing in this ADR could.** At twenty CI runs a day, nine minutes a run is still about 5,400 minutes a month against 2,000. The overage is driven by development velocity, not by waste.
- **A second consumer starts now and is larger than anything saved here.** `news.yml` was given `cron: "*/30 * * * *"` on 10 November (ADR-027) and has run once so far. Forty-eight runs a day is about 1,440 runs a month at one to two billed minutes each, so **the poller alone will take most or all of the 2,000**. Its own comment reasons that ninety-six runs a day "would spend more Actions minutes than a private repository has"; forty-eight does not fit either. It polls RSI's Comm-Link hub, the wiki API and the roadmap board — **not** YouTube RSS, so no section 9 rate limit is at issue. The options are to widen the cron until the pollers move to Fly, where ADR-027 always intended them, or to accept the spend; both are owner calls and neither is taken here.
- The two structural fixes are outside an ADR about CI shape: **make the repository public**, which makes Actions free and is entangled with the undecided License in section 12, or **pay** (Pro is 3,000 minutes, still short at this velocity). Flagged, not resolved.
- A docs-only PR no longer carries a Playwright or Lighthouse report. That is the intended trade: neither can change when no code did. Any PR touching a non-documentation path still runs both, so the section 8 obligations are unaffected for the PRs they describe.
- `main` no longer re-runs e2e and Lighthouse after a merge. If `main` is ever pushed to directly rather than through a PR, those gates will not have run on that commit — one more reason the PR route should stay the only route.
