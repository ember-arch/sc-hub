# fixtures/acquisition

Shops, prices and loaners for the ship file (ADR-013, ADR-015). Not game data. Nothing here is written by hand.

- `PledgeOffer.json`: RSI pledge-store items that are a ship, upgrade to it or contain it. Ships in the pack come from the store as the Star Citizen Wiki API relays it; concept ships come from the schema.org offer on the ship's own RSI pledge page.
- `ShopPrice.json`: UEX Corp's community-reported purchase and rental prices per in-game shop terminal, as the wiki relays them, for the pack's LIVE build only. UEX: "Data is community-maintained and may not reflect live servers." UEX does not state the rental period.
- `LoanerMatrix.json`: RSI's loaner ship matrix, the support article listing every ship that is not flight ready with what RSI lends for it, with RSI's own "Last updated" date and build. Checked weekly by `.github/workflows/loaner-matrix.yml`.
- `samples/loaner-article.json`: the matrix article trimmed by rule (the update line and five rows, one repeated) for the parser's tests.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/acquisition.ts
pnpm --filter schema build && pnpm exec tsx scripts/bootstrap-fixtures/loaners.ts
```

The acquisition script makes one wiki request per pack ship through the bootstrap's rate-limited client and one RSI request per concept ship, five seconds apart. It halts on a record for another game version, an unknown store source or an unknown offer shape, and writes nothing. A store row listed at exactly $0 is left out and named in the log (ADR-013). The loaner script makes one request to RSI's help centre, writes only when RSI changed the article, and halts on a table it does not recognise.
