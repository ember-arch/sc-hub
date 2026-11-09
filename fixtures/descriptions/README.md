# fixtures/descriptions

Some game data via the Star Citizen Wiki API (api.star-citizen.wiki).

CIG's own in-game description of each ship in `fixtures/bootstrap`, for the cinematic ship page concept (ADR-008). Each row is copied from the game localization as the wiki API serves it (`game_description.en_EN`, falling back to the ship-matrix `description.en_EN`), for the same game version as the pack. Only a leading "Manufacturer: / Focus:" header block is removed. Nothing here is written by hand.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/descriptions.ts
```

The script makes one request per ship through the bootstrap's rate-limited client and refuses to write rows for a different game version than the pack's. The site reads this file if it exists; without it, ship pages simply have no description.
