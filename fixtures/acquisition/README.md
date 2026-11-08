# fixtures/acquisition

Shops and prices for the ship file (ADR-013). Not game data. Nothing here is written by hand.

- `PledgeOffer.json`: RSI pledge-store items that are a ship, upgrade to it or contain it. Ships in the pack come from the store as the Star Citizen Wiki API relays it; concept ships come from the schema.org offer on the ship's own RSI pledge page.
- `ShopPrice.json`: UEX Corp's community-reported purchase and rental prices per in-game shop terminal, as the wiki relays them, for the pack's LIVE build only. UEX: "Data is community-maintained and may not reflect live servers." UEX does not state the rental period.
- `ShipLoaner.json`: the loaners the wiki lists for each ship.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/acquisition.ts
```

The script makes one wiki request per pack ship through the bootstrap's rate-limited client and one RSI request per concept ship, five seconds apart. It halts on a record for another game version, an unknown store source or an unknown offer shape, and writes nothing.
