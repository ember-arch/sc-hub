# fixtures/cargo

The standard cargo containers' shapes for the ship file's Cargo section (ADR-028). Game data, read from records, never typed in.

- `CargoBox.json`: one row per container size in SCU (1, 2, 4, 8, 16, 24 and 32) with the width, height and length in metres the game gives that size, read from every cargo item record the Star Citizen Wiki API lists for the pack's build (the commodity containers named `…_1SCU_…`, `…_2SCU_…` and so on; 1,294 records agreed on the seven shapes on 2026-11-10). A record named for a size whose volume is not that size (a corpse container, a pod named for the slot it takes) is left out and counted as irregular; two standard shapes for one size halt the run.
- `samples/items-cargo.sample.json`: the first page of the API's cargo items cut by rule (the fields the script reads, one record per size, plus one record of another build) for the script's tests. No test reaches the network.

The grids themselves are in the vehicle records of the bootstrap pack (`VehicleStats.raw.cargo_grids`): each grid's width, height and length, its SCU, whether it is open to space, and the largest box it takes.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/cargo-boxes.ts
```

Eight requests to the wiki API, 200 records a page, through the bootstrap's rate-limited client. The daily refresh (ADR-023) runs it after a rebuild of the pack.
