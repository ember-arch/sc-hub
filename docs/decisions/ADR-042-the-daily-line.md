# ADR-042: The front page's title is a daily line composed from the pack

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("the main page headline (which right now says 'every ship, every part, etc') should also be a quick tagline updating daily on what's going on in and around the verse that day (could be an events in game, external events, issues, patch, news, spectrum conversation, squadron 42, etc etc) Keeps the page fresh", 2026-11-10; asked whether the words should be composed from the pack by rule or written by Claude at build, chose "Composed from the pack", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-020 and ADR-021 (the front page's title), ADR-038 (the masthead), system.md's Home row

## Context

The front page opened on a fixed title, "Every ship, part and honour on record." (ADR-020). With the hero home page (ADR-038) the rest of the page is current every build; the owner asked for the title to be current too: a line on what is going on in and around the 'verse that day. The site's tagline (ADR-041) now says what the site is, so the title no longer has to.

What the pack knows each build: the Spectrum threads CIG staff opened and when they last posted in them (ADR-027, ADR-039), the dispatches (ADR-029), the LIVE and PTU builds in the footer's patch strip (ADR-007), and the funding counters (ADR-018, ADR-038). What it does not know: in-game events, Squadron 42 news or "issues" as such, except as a dispatch or a thread names them. CLAUDE.md section 2 forbids hand-entered data and the site has no language model in its stack; the owner chose a line composed by rule over one written by Claude at build (which would need a key as a repository secret and an allowance for generated copy).

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The line | `dailyLine` in `apps/web/lib/front.ts`: two clauses joined with ", and", a capital at the start and a full stop at the end. The first is the freshest word from CIG: the newest staff-opened Spectrum thread with a staff post (Spectrum on) or the newest dispatch, whichever is newer, as "CIG posted “<title>” on Spectrum 4 h ago" ("posted in" when the freshest staff post answers the thread rather than opens it) or "the latest dispatch is “<title>”, 1 d ago", the time in the cards' own words (`formatTime`: relative under a week, then the date). The second alternates by the UTC day between the builds ("Alpha 4.10.2 is live and 4.10.3 is on the PTU") and the funding ("$132.1M pledged in 2026, +19.9% on 2025"), so the line changes shape day to day as well as with the pack. With nothing on the pack: "Star Citizen, on record." | Two clauses read as a line; four read as a list. Every word is the pack's or the rule's; the rule is stated here |
| Titles | A thread's title is CIG's, trimmed for a headline by two rules only: an audience tag in brackets at the front ("[All Waves]", "[Wave 1]", "[Evocati]"; never another bracketed word, such as "[Now Closed]") and a build number of six digits or more at the end are dropped (`headlineTitle`). A dispatch's title is not changed. Either is quoted whole up to 90 characters and cut on a word with an ellipsis beyond (`headlineCut`), so the line stays a line on a phone | A headline, not a record; the card below carries the title whole |
| Where it sits | The front page's h1, in `title` size on phones and `display` from `lg`, beside the contents as before; the date label above it gains "· in the ’verse" (not "today": a day without a build keeps the previous line, ADR-038). The page's metadata title stays the site's name and its description the tagline | The h1 is read first; a sentence at `hero` size would run to six lines on a phone |
| Freshness | Composed at build from `now()`, like the date line and the daily ships (ADR-038): the news run rebuilds the page every two hours, the daily refresh every day | |

## Alternatives considered

| Option | Why not |
| --- | --- |
| A line written by Claude at build from the same facts | The owner chose composition; a key and generated copy on the site would each need their own allowance |
| Three or four clauses | Reads as a list, not a line; the page below is the list |
| Keep the fixed title and add the daily line under it | Two titles; the owner asked for the title to be the line |
| Hand-written event calendar (CitizenCon, IAE) | CLAUDE.md section 2 |

## Consequences

- `apps/web/lib/front.ts` gains `DailyFacts`, `headlineTitle`, `shortBuild` and `dailyLine`, unit-tested on fixed facts and days; `apps/web/app/page.tsx` composes the facts from the repository, the funding headline and the featured threads and sets the h1.
- system.md's Home row and spec 06's hero criterion say the title is the daily line; the home records change; `home.spec` checks the h1's shape.
- A day with neither a news run nor a refresh keeps the previous build's line, as it keeps its date (ADR-038).
- Deferred from the audit: on an even day the funding clause repeats the strip's "This year" figure beneath it, accepted since the owner asked for the funding in the line; the e2e checks the line's shape, not its words, since the words are the pack's; a pack with no LIVE build and no funding gives a one-clause line.
- The owner's other sources (in-game events, Squadron 42) join the line when the pack carries them as dispatches or threads; nothing is added by hand.
