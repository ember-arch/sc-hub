# fixtures/events

CIG's shows (ADR-057), read from RSI's own pages by `scripts/events/fetch.ts` in the News workflow.

- `registry.json` — one row per show: its slug, kind, schedule Comm-Link and FAQ thread. The only file here kept by hand; it holds pointers, never facts (`docs/runbooks/events.md`).
- `<slug>.json` — the show as `EventRecord` (`packages/schema/event.ts`): its dates and hours, place, days with their makers and ships, the stock-limited sale, and the sources. Written by the step; never edited by hand.
- `state.json` — the phase each show was last read in (`before`, `opening`, `day-N`, `after`). It changes when a show moves on, which makes the commit that rebuilds the site with the new day.
- `samples/` — RSI's schedule page and its body as served on 2026-11-12, and the news pack's rows the tests read; the fixture tests run on these, never on the network.
