# fixtures/titles

Every Star Citizen title (the badges RSI shows beside a player's name on Spectrum, the forums and the citizen dossier), copied by script from the Star Citizen Wiki's [Titles](https://starcitizen.tools/Titles) article (ADR-017). Nothing here is written by hand.

**Text credit and licence.** The sentences in `Titles.json` (`lead`, each group's `intro`, each title's `earned_by` and `reward.text`) and the trimmed article in `samples/` are the Star Citizen Wiki contributors' text from starcitizen.tools, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They stay under that licence. Changes made: wiki markup, footnote markers and links to other wiki pages removed; links out to other sites kept. The revision copied is in `Titles.json` under `source.revision_url`. Names, groups, pledge totals, recruit counts and session counts are plain facts read from the article's columns.

Icons are not here. They are CIG's art; see `fixtures/titles-media/`.

| File | What it is |
| --- | --- |
| `Titles.json` | The catalogue: source and licence, the article's opening paragraphs, each group's heading and paragraphs, and every title. Validated against `TitleCatalog` in `packages/schema/entities/title.ts`. |
| `samples/Titles.sample.html` | The article body with the skin removed (every section, paragraph and table row, and the references the rows cite), for the parser's unit tests, which check it reproduces `Titles.json` exactly. |

**Do not edit by hand.** Regenerate with:

```
pnpm --filter schema build && pnpm exec tsx scripts/titles/fetch.ts
```

The script makes one request for the rendered article with the project User-Agent; the wiki's robots.txt rules out its API and asks for 5 seconds between requests. The parser stops on any section, table header or cell it does not know, and on any change to the sentences that say which groups can still be earned; then nothing is written.
