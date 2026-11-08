# Attribution lines

Exact strings live in `packages/ui/legal.ts`. These are the required credits and where each appears.

| Credit | Where | Text (adjust names only if a project renames itself) |
| --- | --- | --- |
| CIG / RSI | Every footer | The verbatim fan-site disclaimer (see `obligations.md`) plus: "Star Citizen®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC." |
| Star Citizen Wiki API | About page; every page showing data sourced from it until the pipeline replaces that data | "Some game data via the Star Citizen Wiki API (api.star-citizen.wiki)." with a link |
| UEX Corp | About page; under the in-game shop table and in the source list of every ship file that shows its prices; under the ships table and the compare table (ADR-013) | "In-game shop prices: UEX Corp community reports (uexcorp.space), via the Star Citizen Wiki API." with a link, plus UEX's notice "Data is community-maintained and may not reflect live servers." Written permission from UEX is still to be asked for before launch |
| RSI pledge store | About page; source list of every ship file that shows a pledge price; under the ships table, the compare table and the home register (ADR-013) | "Pledge prices: the Roberts Space Industries pledge store." with a link; store links never carry referral codes |
| StarBreaker | About page | "Game data and models extracted with StarBreaker." with a link to the repo |
| unp4k | About page | "Archive handling informed by unp4k." with a link |
| Fankit | About page and image captions where a fankit image is used | "Image: CIG fankit." |
| Fankit Agreement notice | Every footer, wherever fankit assets appear (ADR-009) | Clause 2(g) verbatim: `FANKIT_NOTICE` in `packages/ui/legal.ts` |
| RSI ship images | Under each ship image copied from RSI's ship matrix, linked to the ship's RSI page; about page (ADR-009) | "Image: Roberts Space Industries" |
| RSI holoviewer models | Under each holoviewer, linked to the ship's RSI pledge page; in every ship file's source list; about page (ADR-015) | "Model: RSI holoviewer"; on the about page "3D models: Roberts Space Industries' holoviewer, from each ship's pledge page." |
| RSI loaner ship matrix | In the source list of every ship file, with RSI's last update; about page (ADR-015) | "RSI loaner ship matrix"; on the about page "Loaners: the Roberts Space Industries loaner ship matrix, checked weekly." |
| Open-source libraries | `/licenses` route generated at build from package metadata | Auto-generated |

The about page also states plainly, in one sentence, that the site is a fan project built by one person with no affiliation to CIG, and names the contact address for corrections and takedowns.
