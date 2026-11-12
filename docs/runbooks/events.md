# Runbook: the shows (ADR-057)

## What runs

The News workflow's step "Read the shows' schedules" runs `scripts/events/fetch.ts` after the polls, every time the workflow runs (at 7 and 37 past the hour). For each show in `fixtures/events/registry.json` it reads the FAQ from the news pack and, only when the show is new, has moved on since its last read (it opens, a day turns over) or was last read on an earlier UTC day, RSI's schedule page: two requests, 5 seconds apart. Once the show is over RSI is not asked again. It writes `fixtures/events/<slug>.json` when the data changed and `fixtures/events/state.json` when the phase did; the workflow's commit then redeploys the site.

## Adding a show

When RSI publishes a show's schedule (a Comm-Link, usually titled "… Free Fly and Manufacturer Schedule") and, later, its FAQ on Spectrum:

1. Add one row to `fixtures/events/registry.json`:

   ```json
   {
     "slug": "invictus-2957",
     "kind": "invictus",
     "schedule_comm_link": "<the Comm-Link's id>",
     "faq_thread": "<the FAQ thread's id, or null>"
   }
   ```

   The slug is the show's address (`/events/<slug>`) and never changes once published. The kind is `iae`, `invictus`, `citizencon` or `other`.

2. Read it once by hand and look at the result:

   ```
   pnpm --filter schema build
   SC_HUB_CONTACT_EMAIL=ventures@coppercork.com pnpm exec tsx scripts/events/fetch.ts --save-samples
   ```

   `--save-samples` keeps RSI's two pages in `fixtures/events/samples/` for the tests.

3. Open a pull request with the row, the record and the state file. From then on the News workflow keeps it current.

The Comm-Link must already be in the news pack (the step waits for it otherwise). The FAQ row may be `null` until RSI posts one; add its id when it appears.

## A halt

A show whose page or FAQ has a shape the step does not recognise (a new component on RSI's page, a day label it cannot read, a FAQ wave line in a new form, text outside the blocks it reads) or that RSI answers with anything but 200 keeps its record as it was; the other shows, and the news, still land. The run shows an error titled "The shows' step" and the log line `events.halted` names the problem. The state file still records the show's phase, so the site turns to the new day, and RSI is not asked again until the next phase or the next UTC day. Run the step by hand with `--force --save-samples` (the pages are saved even when parsing fails), add the rule the page needs in `scripts/events/parse.ts` or `build.ts` with a test on the saved page, rebuild `fixtures/events/samples/iae-2956.record.json` if the samples changed, and open a pull request. Never edit `fixtures/events/<slug>.json` by hand.

## A takedown

A takedown on the schedule Comm-Link in the news pack removes the show's record and its state at the next run; one on the FAQ removes the sale.

## Forcing a read

`--force` reads every show in the registry whether or not it is due.

## Looking at a day of the show locally

`SITE_CLOCK` pins the site's clock off Vercel: `SITE_CLOCK=2026-11-15T18:00:00Z pnpm --filter web dev` shows the event page and the front page as on the evening of Day 3.
