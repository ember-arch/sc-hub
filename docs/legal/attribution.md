# Attribution lines

Exact strings live in `packages/ui/legal.ts`. These are the required credits and where each appears.

| Credit | Where | Text (adjust names only if a project renames itself) |
| --- | --- | --- |
| CIG / RSI | Every footer | The verbatim fan-site disclaimer (see `obligations.md`) plus: "Star Citizen®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC." |
| Star Citizen Wiki API | About page; every page showing data sourced from it until the pipeline replaces that data | "Some game data via the Star Citizen Wiki API (api.star-citizen.wiki)." with a link |
| StarBreaker | About page | "Game data and models extracted with StarBreaker." with a link to the repo |
| unp4k | About page | "Archive handling informed by unp4k." with a link |
| Fankit | About page and image captions where a fankit image is used | "Image: CIG fankit." |
| Fankit Agreement notice | Every footer, wherever fankit assets appear (ADR-009) | Clause 2(g) verbatim: `FANKIT_NOTICE` in `packages/ui/legal.ts` |
| RSI ship images | Under each ship image copied from RSI's ship matrix, linked to the ship's RSI page; about page (ADR-009) | "Image: Roberts Space Industries" |
| Open-source libraries | `/licenses` route generated at build from package metadata | Auto-generated |

The about page also states plainly, in one sentence, that the site is a fan project built by one person with no affiliation to CIG, and names the contact address for corrections and takedowns.
