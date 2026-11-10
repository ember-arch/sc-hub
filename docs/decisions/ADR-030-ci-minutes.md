# ADR-030: The quality gates run where they are a gate

- Status: accepted (owner direction 2026-11-10, "yes optimize it"); refines CLAUDE.md section 6 without changing what it requires. Does **not** resolve the structural overage recorded under Consequences, which is an owner decision
- Date: 2026-11-10
- Deciders: owner, Claude Code session 2026-11-10

## Context

The owner had been receiving repeated "ember-arch's minutes are running out" notifications from GitHub and asked, while Coppercork was being decommissioned, whether disabling that project's scheduled job would stop them.

It would not. Coppercork's `Catalog refresh` was 98 billed minutes a month. This repository's CI is the consumer, and two facts about Actions billing drive everything below: it bills **per job**, and it **rounds every job up to the whole minute**, so a job costs a minute before it does any work.

Measured per CI run: Lighthouse 6 min (358s), Playwright 5 min (287s), `check` 4 min (199s), and "Detect which surfaces exist" **1 min for eleven seconds of work**. Sixteen billed minutes a run.

Frequency is the part a thirty-day average hides. The repository is four days old, so that window flatters it. Over the seven days to 10 November CI ran **142 times** — about twenty a day, or roughly **610 runs a month at current velocity**, not the 140 a thirty-day count implies.

There is no branch protection — the Free plan cannot enable it — so no status check is a required check, and moving a job cannot block a PR on a missing report.

## Decision

Only two changes survived measurement.

| Concern | Choice |
| --- | --- |
| The `detect` job | **Removed.** It tested for `apps/web/package.json` in eleven seconds and was billed a full minute for it, every run. `apps/web` exists, so the question is settled and its answer was always `true`. What replaces it is a **step inside `check`**, which runs anyway — a second job would have cost the minute it was meant to save, which is the mistake `detect` was making |
| Where e2e and Lighthouse run | **Pull requests only, and not a PR that touches only documentation.** CLAUDE.md section 6 frames Lighthouse as failing "a PR", and section 8 requires that "the PR has Playwright screenshots". A push to `main` is a PR that already passed both. The filter is a **deny** list — everything except `docs/**`, `spec/**` and `**/*.md` counts as app code — so a new source directory costs a run rather than slipping past an allow list nobody extended |
| `numberOfRuns` in `lighthouserc.json` | **Left at 3.** Cutting it would save time by making the measurement noisier, and section 6 treats the budgets as tests. Cost is not a reason to measure worse |
| Everything else in `e2e` and `lighthouse` | **Unchanged from before this ADR**, including the Next.js build cache in both jobs, which `next/font/google` earns by downloading the faces at build (ADR-020) |

### Two changes that sounded right and measured as losses

Both are recorded because they are the changes someone will propose again.

| Idea | What happened |
| --- | --- |
| Have `check` upload `.next` so Lighthouse skips its own build | **Slower.** `.next` is 137 MB; compressing, uploading, downloading and extracting it cost more than a compile does on a warm 53 MB build cache. Lighthouse went 358s → 392s. Reverted |
| Cache the Playwright browser at `~/.cache/ms-playwright` | **Slower.** That cache is 292 MB, and restoring it costs more than letting Playwright fetch chromium (~150 MB). e2e went 287s → 380s even with the cache warm. Reverted. A contributing error was mine: the first attempt also dropped the Next.js build cache from `e2e`, which `pnpm test:e2e` relies on |

A run of the full four-change version cost **19 billed minutes against the 16 it replaced**, warm caches included. That is why only two changes remain.

## Consequences

- A **docs-only PR** and a **push to `main`** cost **4 billed minutes instead of 16**. This is where the saving is, and it is real: 33 of the 140 runs in the measured month were pushes to `main`.
- A **code PR** saves only the `detect` minute: **15 instead of 16**. Honest and small.
- **This does not bring the account inside its allowance, and nothing in this ADR could.** At twenty code-PR runs a day, fifteen minutes a run is about 9,000 minutes a month against 2,000. The overage is development velocity, not waste.
- **A second consumer starts now and is larger than anything saved here.** `news.yml` was given `cron: "*/30 * * * *"` on 10 November (ADR-027) and has run once. Forty-eight runs a day is about 1,440 runs a month at one to two billed minutes each, so **the poller alone will take most or all of the 2,000**. Its own comment reasons that ninety-six runs a day "would spend more Actions minutes than a private repository has"; forty-eight does not fit either. It polls RSI's Comm-Link hub, the wiki API and the roadmap board — **not** YouTube RSS, so no section 9 rate limit is at issue. Either widen the cron until the pollers move to Fly, where ADR-027 always intended them, or accept the spend. Both are owner calls and neither is taken here.
- The two structural fixes are outside an ADR about CI shape: **make the repository public**, which makes Actions free and is entangled with the undecided License in section 12, or **pay** (Pro is 3,000 minutes, still short at this velocity). Flagged, not resolved.
- A docs-only PR no longer carries a Playwright or Lighthouse report. That is the intended trade: neither can change when no code did. Any PR touching a non-documentation path still runs both, so the section 8 obligations are unaffected for the PRs they describe.
- `main` no longer re-runs e2e and Lighthouse after a merge. If `main` is ever pushed to directly rather than through a PR, those gates will not have run on that commit — one more reason the PR route should stay the only route.
- Fixed in passing, unrelated to cost: the Lighthouse report upload names `.lighthouseci`, a dotted directory, and `upload-artifact` skips hidden files by default. With `if-no-files-found: ignore` it produced nothing and said nothing. Those reports have never been uploaded; `include-hidden-files: true` fixes it.
