# Spec 03 — News feed and dev tracker

- Phase: 3 (weeks 9 to 12)
- Machine: laptop or cloud session; Fly.io for deployment
- Gate: items appear within 15 minutes of publication; entity-link precision ≥ 98% on a 200-item sample; the dev tracker is live or formally deferred to v1.1 in an ADR
- Blocking dependency: `docs/legal/cig-approval.md` → Spectrum box ticked before any Spectrum content goes to the live site

## Goal

The Wowhead half of the product: every Comm-Link, patch note, roadmap change, and RSI video in one normalized feed, every CIG staff post from Spectrum in a tracker with author pages, and entity linking so a post that mentions a ship appears on that ship's page.

## Out of scope

Comments, reactions, accounts. Translation. Any content source not listed.

## Acceptance criteria

- [ ] **Content schema and storage.** `ContentItem`, `Author`, `EntityLink` tables from `docs/data-model.md`; revisions on source edits; takedown flag honored on read (410) and in indexing.
- [x] **Comm-Link poller.** Fetches new Comm-Links from RSI public pages (and backfills the archive via the Star Citizen Wiki API with its credit line), normalizes title, summary, sanitized body, published time, canonical URL. Interval 15 minutes. Injected `fetch`; fixture-tested. (ADR-027: the hub page for discovery, the wiki's record for the text, filler and banner tokens in that record cleaned; `workers/poll-news`, run every thirty minutes from `.github/workflows/news.yml` until Fly, where the fifteen-minute interval returns.)
- [ ] **Patch notes poller.** Public patch-notes page, same contract, with the version string parsed into `game_version` where present.
- [ ] **Roadmap and progress tracker poller.** Public JSON endpoints; a change in a card or deliverable creates a `ContentItem` of source `roadmap` or `progress_tracker` with a diff summary in the body. (The Release View board is done, ADR-027; the progress tracker board follows.)
- [ ] **Video poller.** RSI YouTube channel RSS hourly; items link to YouTube, never embed autoplay.
- [ ] **Entity linking job.** `pnpm workers:link` builds the alias dictionary from vehicles, items, and manufacturers, matches content bodies by the confidence table in `docs/data-model.md`, stores links with positions, hides links under 0.9. Exclusion list in `workers/link-entities/exclusions.json`. Precision measured on a labeled 200-item sample committed to `fixtures/linking/`.
- [ ] **Feed UI.** `/news` with source filter chips, `FeedItem` list, pages of 20, entity chips linking to pages, visible source link on every item; `/news/rss.xml` and `/news/feed.json`. (All but the entity chips, which wait on the linking job, ADR-027. ADR-029: the list is `DispatchCard`s with RSI's covers, the newest as the lead, and carries what CIG publishes only; developer posts stay on the tracker, and the feeds syndicate the dispatches.)
- [ ] **Entity pages gain sections.** "In the news" on ship, component, and manufacturer pages, newest first, five items with a link to the filtered feed.
- [x] **Spectrum adapter interface.** `workers/poll-spectrum/adapter.ts` defines `fetchNewStaffPosts(since)`, returning normalized posts; two implementations: `feed` (reads a CIG-provided export or webhook; format TBD, stub that validates a documented JSON shape) and `poll` (sanctioned service account, 5-minute interval, backs off to 30 minutes on any non-200, identifies itself per `obligations.md`). `SPECTRUM_MODE` selects one; `off` disables the module and hides the tab. (ADR-027: `poll` reads Spectrum's own search filtered to the staff highlight, without a sign-in or any account, resolving the staff role from Spectrum's role list each run and halting on any other shape; `pnpm workers:poll-spectrum` writes the news pack and `fixtures/news/Author.json`; the site shows Spectrum items and draws the tab only when its `SPECTRUM_MODE` is `poll` or `feed`. The five-minute spacing holds within a run; carrying a backoff across scheduled runs waits for Fly. The live site waits on the approval box.)
- [x] **Staff identification.** A post is a dev post when the author carries the staff badge or appears in `workers/poll-spectrum/staff.json`, which is maintained by hand and reviewed each patch. (ADR-027: the first test is the post's highlight, Spectrum's own staff role, which only a holder of the role can set; then `src/staff.ts`, a badge matched whole, case aside, or a listed handle; nothing is guessed from a name. "Developer" is the badge real staff hits carry; the list starts empty.)
- [x] **Dev tracker UI.** `/news/dev` tab: `DevPost` cards newest first, folded by default to the thread's title, the author, the time and the first lines and opened to the full text with quotes preserved (ADR-035; the thread grouping of the first version is withdrawn), author filter, source link always visible. (ADR-035, on the owner's direction of 2026-11-10: one folded card per post, newest first, twenty a page, with the thread's title, the author, the time and the first lines, opened with a tap to the whole post across the card's width; the links to the post and its thread always visible; author chips; the thread grouping of the first version is withdrawn. The text as the search answer carries it, in paragraphs, until the post's own blocks and pictures are read. Empty, with the reason, while the module is off.)
- [x] **Author pages.** `/news/dev/[handle]`: handle, role, first seen, post count, posts newest first. No avatars or personal details. (From `fixtures/news/Author.json`; posts twenty a page, since the first real run gave one developer 168 in a year; a 404 for any handle not on it, so none exists while the module is off.)
- [x] **Backfill.** The staff posts back to the news window (14 May 2026, the first day of DefenseCon 2956, ADR-031; twelve months before the owner's cut of 2026-11-10) imported before the tracker goes live, rate-limited per `CLAUDE.md`, run from Fly with progress logged. (ADR-027: run locally on 2026-11-10, since Fly does not exist yet: `pnpm workers:poll-spectrum --backfill 400` read the search's `year` range, forty-eight pages five minutes apart with one log line per page, and wrote 1,182 staff posts from 2025-11-10 to 2026-11-10 by 45 authors into the pack. The search's range reaches a year and no further. ADR-031: the owner then set the window at the first day of DefenseCon 2956, 14 May 2026, which took in Invictus Launch Week 2956; the pack was trimmed to it, 516 posts by 34 authors, and nothing older is collected or shown.)
- [ ] **Admin takedown route.** `/admin/takedown` behind basic auth; flips the flag on a content item, author, or model; `pnpm workers:takedown --source <s>` flags a whole source. Tested end to end: flag → 410 → gone from search within one index cycle.
- [ ] **Deployment.** Pollers and the link job run on a Fly machine with health checks and a summary log line per run; Sentry alerts on three consecutive failures.
- [ ] **Decision recorded.** If the Spectrum approval box is still unticked at the end of the phase, an ADR defers the dev tracker to v1.1 with the exact blocker, and `SPECTRUM_MODE=off` ships.

## Suggested order

1. Schema, storage, takedown flag and admin route (so nothing can go live without a kill switch).
2. Comm-Link poller and backfill; feed UI.
3. Patch notes, roadmap, video pollers.
4. Linking job, sample labeling, precision measurement; entity-page sections.
5. Spectrum adapter interface and `poll` implementation against a sandbox account; `feed` stub.
6. Dev tracker UI, author pages, backfill (only after the approval box is ticked).
7. Fly deployment and alerting.

## Verification

Fixture-based tests for every poller; a live run on the preview shows a Comm-Link within 15 minutes of publication (owner confirms with a timestamp); precision report attached; takedown test recorded as a Playwright run.

## Notes

- Sanitize every body with an allowlist (headings, paragraphs, lists, quotes, links, images from the source domain). No scripts, no iframes.
- Never summarize a dev post with generated text. The summary is the first paragraph or nothing.
