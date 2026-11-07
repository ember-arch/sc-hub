# Takedown procedure

Commitment: any item CIG asks to be removed is gone from the live site, search, and CDN within 48 hours of the request, and usually within one job cycle.

## Mechanism

Every `ContentItem`, `Author`, and `Model` row has a `takedown` boolean. Setting it:

1. Makes the page return HTTP 410 immediately (the app checks the flag on read; no deploy).
2. Removes the item from Meilisearch on the next index cycle (at most 15 minutes).
3. For models, deletes the objects from R2 on the next publish job and purges the CDN cache.
4. Logs who set it, when, and the reason, in `takedown_log`.

An admin route `/admin/takedown` (basic auth from an environment variable, no accounts) lists items by URL or id and flips the flag. It is built in Phase 3 before any Spectrum content goes live, and tested in Phase 5 as a launch criterion.

## Request handling

1. Requests arrive at the published contact address (about page, footer).
2. The owner confirms the request is from CIG (reply to a known contact, or verify through the named contact in `cig-approval.md`).
3. Flip the flag. Reply with confirmation and the time it went into effect.
4. Record the request and outcome in `cig-approval.md` under "What was asked for".

## Whole-source takedown

If CIG withdraws approval for a whole source (for example all Spectrum posts), set `SPECTRUM_MODE=off`, run `pnpm workers:takedown --source spectrum`, which flags every item from that source and purges the index. This command exists from Phase 3.
