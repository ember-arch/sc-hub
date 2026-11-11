# ADR-013: Shops and prices in the ship file

- Status: accepted (owner chose "Shops and prices" as the next gap, 2026-11-08); extends ADR-012; loaners from RSI's loaner matrix by ADR-015
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

ADR-012 left "Shops and prices" as a named gap in every ship file's Acquisition section. A captain or an org deciding on acquisition needs the pledge price and whether it is on sale, whether the ship can be bought or rented in the game and where, what an insurance claim costs in time, and which loaners come with it.

None of this is DataCore game data except insurance. CLAUDE.md section 2 forbids typing in game data; prices are copied from their sources, never entered or converted.

## Decision

| Concern | Choice |
| --- | --- |
| Pledge prices, ships in the pack | RSI's pledge store as the Star Citizen Wiki API relays it (`skus` on the vehicle record). Each row keeps the item title, its store section from the URL ("Standalone Ships", "Upgrades", "Packs", "Ship Roms"), the US dollar price, the warbond flag, availability and the time the wiki last read it. The kind (standalone, upgrade, pack, other) comes from the section and the pack flag; an unknown section stays "other" under its own name |
| Stale upgrade rows | The wiki also relays `upgrade_api` rows: upgrade listings last read in 2024 and 2025, with no store link, some still marked available. They are left out and counted by the script. Any other unknown source halts the run |
| Rows at no price | Added 2026-11-11 (issue 34): a `pledge_store` row the store lists at exactly $0 is nothing a backer pays for, so it is left out and named in the run log (`skipped_zero_price`). A negative or missing price still halts the run |
| Pledge prices, concept ships | RSI's own schema.org `Offer` in the JSON-LD of the ship's pledge page (the Odin: 5,900 USD, out of stock on 2026-11-08). One request per concept, five seconds apart, with the project User-Agent. Warbond is "Not stated" because the offer does not say |
| Headline pledge price | The lowest standalone, non-warbond price on sale; when none is on sale, the most recently listed one, marked "not on sale" with its read date |
| In-game shops | UEX Corp's community reports as the wiki relays them (`uex_prices`): one row per terminal with purchase and rental prices, location, system and report date. Only rows for the pack's LIVE build are kept; rows for other builds are counted and left out. UEX does not state the rental period, so the page does not call it a daily price |
| Insurance | Claim time, expedited claim time and fee from the pack's raw remainder (game data the wiki serves). Times are minutes, as starcitizen.tools labels the same values; the fee is in aUEC, the game's only currency |
| Loaners | The wiki's `loaner` list for the ship, names only, labelled as the wiki lists them |
| Storage | `fixtures/acquisition/` (`PledgeOffer.json`, `ShopPrice.json`, `ShipLoaner.json`), validated by `PledgeOffer`, `ShopPrice` and `ShipLoaner` in `packages/schema/entities/acquisition.ts`, written only by `scripts/bootstrap-fixtures/acquisition.ts`. Optional: without the folder the section says nothing is on file. Not part of the data pack or the database until the owner approves it. `ShipLoaner.json` was replaced by RSI's loaner matrix, `LoanerMatrix.json` (ADR-015) |
| Page | Acquisition gains pledge, upgrade, pack, buy, rent, insurance and loaner facts, then two tables: Pledge store (item, kind, price, warbond, status, last read) and In-game shops (shop, location, system, buy, rent, reported). The left column's particulars gain Pledge and Buy in game, so every ship file has twelve rows |
| Credit | Sources list entries for the RSI pledge store and for UEX Corp; under the shop table, UEX's own notice ("Data is community-maintained and may not reflect live servers"); `UEX_CREDIT` and `PLEDGE_STORE_CREDIT` in `packages/ui/legal.ts`, both on the about page. Store links carry no referral codes (CLAUDE.md section 2) |

## UEX terms (read 2026-11-08)

UEX's site terms limit use of the website to "personal, non-commercial purposes", and its API terms say nothing about displaying or redistributing the data. No page asks for a badge or a link back. The data is clearly marked as community reports that "may not reflect live servers". Nothing found forbids a non-commercial fan site from showing it, and nothing explicitly allows it.

## Consequences

- Before launch, the owner asks UEX (support email on uexcorp.space/about/terms) for written permission to show its prices, relayed through the wiki, with the credit above. Until then the prices are for local development, like the RSI images (ADR-009).
- Prices go stale. Rerun `scripts/bootstrap-fixtures/acquisition.ts` after the pack is regenerated, or whenever a sale changes the store. Every row shows when it was read or reported.
- The compare page has an Acquisition group (pledge, pledge status, lowest buy and rent, insurance claim, expedite fee); the ships table has Pledge and Buy in game columns, with `unitsBelow` on `DataTable` so thirteen columns fit at 1280 px; the home register has a Pledge column. Each carries a credit line (`PriceCredit`). Cards keep their two stats (system.md section 3).
