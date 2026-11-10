# fixtures/fitting

Pegaxsus's "Star Citizen Ship Fitting List" for the ship file (ADR-028): which ships and ground vehicles fit inside which ships, tested in play by its author and kept in a public Google Sheet, patch by patch. Not game data: community-tested, and shown on the site as such, with the author, the build it was tested on, the date it was last updated and a link. The owner validated the list's measurements in play and accepted it over CLAUDE.md section 2's rule for this one source. Nothing here is written by hand.

- `ShipFit.json`: the sheet's "COMBINED SHEET" read cell by cell: the carriers across its heading row with their H (hangar), C (cargo bay or garage) and CM (cargo module) markers; the vehicles down its rows in their ship and ground sections; each cell's verdict from its colour as the sheet's own legend defines it (a good fit; needs tricks or barely fits; fits but bugged; does not fit; not tested), and the mark written in it with the legend's words where it has them; the "FITS A FABRICATOR?" row; the build heading and the "LAST UPDATE" date. The sheet's names are matched to the pack's by rule and by `scripts/fitting/names.json`; a name the pack lacks (a concept ship) keeps an empty list. `source.consent` records the reuse as agreed, set by the owner (2026-11-10) and kept by the script across runs.
- `samples/sheet-cells.sample.json`: the sheet's cells cut by rule (the heading rows, four ship rows, two ground rows, the rows after "OTHER" and the legend, in the first carriers' columns and a few telling ones) for the parser's tests. No test reaches the network.

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/fitting/fetch.ts
```

One request for the workbook. The script halts on a sheet, a heading or a legend it does not recognise, and writes nothing. The daily refresh (ADR-023) runs it.
