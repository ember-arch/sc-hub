# fixtures/patches

Some game data via the Star Citizen Wiki API (api.star-citizen.wiki).

One snapshot per game build, for the "What changed" patch pages (ADR-049, spec 08): every ship and vehicle with its stock loadout, every part of twenty types and every crafting blueprint the Wiki API serves for that build, each with its figures as the API states them, flattened to dotted paths (`speed.scm`, `vehicle_weapon.damage.burst`). The API keeps every LIVE build it has imported and answers any record as of any of them (`?version=<build>`); it lists no PTU build.

**Do not edit these files by hand.** A build's file is written once and never rewritten (CLAUDE.md section 5). To add the builds the API lists that are not here:

```
pnpm --filter schema build && pnpm exec tsx scripts/patches/fetch.ts
```

`--build <code>` fetches one build; `--refetch` rewrites it (only for a broken file). About 300 requests a build at 2.5 s apart. The daily refresh (ADR-023) runs the same fetch when the API lists a build that has no file.

## The file

`PatchSnapshotFile` in `packages/schema/entities/patch.ts`: a header (build, channel, release date, when fetched, source, counts), then `dictionary`, every figure path, port path, part class and ingredient name once, sorted, one per line, then `ships`, `parts` and `blueprints`, one record per line, whose `figures`, `loadout` and `ingredients` refer to the dictionary by index. `decodeSnapshot` reads it back; the site does that at build time.

What is left out, and why, is in ADR-049 ("Figures").

## samples/

Cut answers of the API for 4.10.2-LIVE.12881860, read on 2026-11-11, for the mapper's unit tests (`scripts/__tests__/patches.snapshot.test.ts`): the Gladius's record with its part-carrying ports (`vehicle-record.sample.json`), the first gun, missile and shield of their pages with prices, pictures and translations removed (`items-page.sample.json`), and two blueprints with the one placeholder that names no output (`blueprints-page.sample.json`).
