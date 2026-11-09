# scripts/bootstrap-fixtures

One-off dev script for spec 00, criterion "Fixtures". It fetches the five ships named in `ships.json` from the Star Citizen Wiki API, together with their stock loadouts and the components those loadouts reference, maps them onto `packages/schema`, validates the result as a data pack and writes `fixtures/bootstrap/`.

Run it from the repo root after building the schema package:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/index.ts
```

It makes about 150 GET requests at one request per 2.5 seconds and takes about six minutes. Progress and problems are JSON lines on stderr; the summary line goes to stdout. For development reruns, `BOOTSTRAP_CACHE_DIR=<folder outside the repository>` replays cached responses instead of fetching; never point it inside the repository.

## What it never does

- Enter, default, convert or infer a game value. Every field is the API's own value or null; the only code "knowledge" is the vocabulary tables in `map.ts` that map the API's type names onto the data model's enumerations, and one exclusion: a hardpoint with an empty name (a dummy the game files declare, with no type and nothing mounted) is counted and left out, since the data model keys ports by name; one that carried a part would halt the run (ADR-022). Likewise a vehicle with no production status (an in-game reward or event variant the ship matrix does not list) is counted under `unlisted` and left out, since the data model needs a status (ADR-022).
- Continue past something it does not understand. An unknown port type, a missing required field, a slug collision the manufacturer prefix does not resolve, or any record that fails the schema halts the run with a report and exit code 1, and nothing is written.
- Exceed the rate limit in CLAUDE.md section 9 (30 requests per minute). One serial queue spaces every request and every retry.
- Run in production or in unit tests. The tests in `scripts/__tests__/` use the trimmed samples the script writes to `fixtures/bootstrap/samples/` and an injected fetch.

## Files

| File | Role |
| --- | --- |
| `ships.json` | The five ships by game `class_name`, the identity CLAUDE.md section 5 names. A display name is ambiguous on the wiki (it resolves to special editions), so the script lists `filter[class_name]` matches, requires exactly one exact match, and fetches that record by uuid. |
| `types.ts` | Loose Zod shapes of the API responses the mapper reads. |
| `fetch.ts` | The spaced, retrying client with an injected fetch. |
| `map.ts` | Pure mapping functions and the vocabulary tables. |
| `build.ts` | Renders the pack files, validates them with `parsePack`, enforces the five-ship rule and the 2 MB cap, trims samples, renders the pack README. |
| `index.ts` | Orchestration and the only code that touches the network or the disk. |

Mapping decisions are recorded in `docs/decisions/ADR-004-db-and-fixtures.md`.
