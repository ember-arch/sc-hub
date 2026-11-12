# Spec 09 — Events: CIG's shows, the Intergalactic Aerospace Expo first

- Phase: beside spec 03's news (the News workflow carries it) and spec 06's front page
- Machine: any machine; RSI is read from CI
- Gate: the event page and the front page's hero render on a preview of `main`, light and dark, phone and desktop, with Lighthouse performance and accessibility ≥ 90 on the event page

## Goal

The owner's direction (2026-11-12): an "everything you need to know" page for the Intergalactic Aerospace Expo that "updates daily with each new manufacturer", graphical and full of pictures, "absolutely gorgeous to look at (since it is a marquee event)": what is happening and where, what the manufacturers say, the new ships on sale, and the hull-limited sales and when. It sits at the top of the front page for the length of the show, in the place of the front page's text block, and is gone the day after the show ends. It is the canonical format for every major Star Citizen and Squadron 42 show: IAE, Invictus, CitizenCon and the like (ADR-057).

## Out of scope

- RSI's own event art (the key art and the day banners) on the site: a media path like the covers' (ADR-051); a follow-up.
- The front page's hero outside a show (the owner's picture-led lead story, changing daily or every couple of days): its own decision and pull request.
- Warbond deals, which RSI does not publish ahead; local times.

## Acceptance criteria

- [x] **Research.** IAE 2956 from RSI's own pages: its dates and hours, its place, its day-by-day makers and ships, its stock-limited waves and hulls, and what RSI published when (ADR-057's context).
- [x] **Record.** `EventRecord` in `packages/schema/event.ts`; `scripts/events/fetch.ts` reads each show in `fixtures/events/registry.json` from RSI's schedule Comm-Link (two requests, 5 s apart, the project User-Agent) and its FAQ from the news pack, halts on any shape it does not know, and writes `fixtures/events/<slug>.json`; fixture tests on the real pages (`fixtures/events/samples/`).
- [x] **Daily ingest.** The News workflow runs the step after its polls; RSI is asked only when a show's phase has changed (it opens, a day turns over, it ends), and the state file's change makes the commit that redeploys the site with the new day.
- [x] **Page.** `/events/<slug>`: the opening band on the day's featured ship, the strip of days, the facts, the day on the floor with every ship as a picture tile, the limited sales (with Spectrum on), the schedule day by day with each day's picture, RSI's dispatches about the show, and the sources; every picture from the media manifest with its credit; `/events` lists the shows; both in the sitemap.
- [x] **Front page.** From the UTC day a show opens to the end of its last day, its hero stands at the top of the front page (in the daily line's and the contents' place when this shipped; in the lead story's since ADR-058), with the strip of days; the day after, it is gone.
- [x] **Checks.** Unit tests, `events.spec.ts`, screenshots of the event page and the index (phone and desktop, light and dark) and of the front page with the hero, and Lighthouse on the event page.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e`.
- Screenshots at 390 px and 1280 px, light and dark, of `/events/iae-2956` and `/`, taken with `SITE_CLOCK` inside the show.
- A fresh-context audit (`KICKOFF.md`, Audit prompt); findings fixed or deferred in the PR description.
