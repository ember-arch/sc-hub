# ADR-005: Design tokens, component library and site shell

- Status: accepted
- Date: 2026-11-07
- Deciders: owner (standing go-ahead to build Phase 0 straight through, 2026-11-07), Claude Code session 2026-11-07 (spec 00, criteria "Design tokens", "Core components", "Site shell", "Command palette", "Legal footer", "Patch strip", plus the CI jobs that need a site)

## Context

`docs/design/system.md` fixes every visual value and names the Phase 0 component set but leaves open the font pair, how the Tailwind config is "generated from" `packages/ui/tokens.ts`, how components get their light and dark screenshots, and where a Phase 0 site reads its data from before Neon, R2 and Meilisearch exist. CLAUDE.md section 2 adds that no color, type size, spacing value or radius may exist outside the token file, and that no page ships without the verbatim disclaimer.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Font pair | Geist Sans for interface text, Geist Mono for numbers, from the `geist` npm package through `next/font` | Self-hosted (no third-party font request, which docs/legal/obligations.md's privacy rule would otherwise need to justify); the pair the design document lists first; tabular figures are set once on `html` |
| Tailwind | Tailwind 4, CSS-first. `packages/ui/tokens.css` is written by `pnpm --filter ui build:tokens` from `tokens.ts`; a unit test fails when the committed file is stale and another fails when `tokens.ts` drifts from the tables in `system.md` | "Generated from the tokens" becomes a build step plus two tests instead of a convention |
| Default palette and scales | The generated `@theme inline` block resets Tailwind's own colors, type sizes, radii, shadows, containers, easings and the spacing multiplier, then defines only the token values | A class outside the token set (`text-red-500`, `p-5`, `rounded-lg`) produces no CSS, so the audit's "any value outside the tokens" check is mechanical |
| Token naming in utilities | Color tokens keep the document's names for CSS variables (`--bg-page`) and drop the group for utilities (`bg-page`, `text-secondary`, `border-hairline`); the map is `colorUtility` in `tokens.ts` | `bg-bg-page` reads badly; the utility prefix already carries the group |
| Scheme switching | CSS only: `prefers-color-scheme` on `:root`, overridable by `data-theme` on any element. `PageShell` takes `theme="dark"` so ship pages default to dark while the rest of the site follows the system (system.md principle 3). `@theme inline` makes utilities resolve the variables at the element, so the override cascades | No theme script, no flash, no stored preference to manage in Phase 0 |
| The one derived color | The command palette's scrim is `bg-page` at 80 % opacity | A scrim needs translucency; the token table has none. Recorded here so it is not an undocumented value |
| Component package | `packages/ui` exports TypeScript source (`exports` point at `.ts`/`.tsx`) and the app lists it in `transpilePackages`; no build step | One compiler (Next's) and live edits; the package has no consumer outside the app |
| Links | `packages/ui` takes `next` as a peer dependency for `next/link` and `next/navigation` only | Client-side navigation and prefetch on every entity link; passing a link component through props or context was more machinery than the dependency |
| Stories and screenshots | `packages/ui/stories/index.tsx` exports one story per component; the app's `/gallery/[story]` route renders a story from fixture rows; Playwright screenshots each story light and dark into `packages/ui/__screenshots__/` | Storybook would add a second build and dev server; the gallery costs one route. Stories take fixture rows because hand-typed stat values would be hand-entered game data |
| Phase 0 data source | `apps/web/lib/data.ts` loads `fixtures/bootstrap` through `schema/pack` at server start and serves every route from memory; the database and search packages are not wired until their specs | The spec says the shell "renders fixture data"; reading the same validated pack the seed uses keeps one contract. The loader fails startup on a pack that does not parse |
| `schema/pack` | `parsePack` and the hashing helpers moved behind the `schema/pack` export; the package root exports only types and `PackError` | `node:crypto` cannot be bundled for the browser; ADR-004 deferred this split to the site shell |
| Disclaimer source | Copied verbatim from the "Fan Sites" section of CIG's Star Citizen Fankit and Fandom FAQ (support.robertsspaceindustries.com article 360006895793) on 2026-11-07; the fankit page itself has no rules text. The same FAQ requires the notice not to be printed smaller than other notices and a link to the official site, so the footer sets it in the `ui` size and links robertsspaceindustries.com | docs/legal/obligations.md says "CIG's own text, verbatim, with the URL and date" |
| Contact address | `CONTACT_EMAIL` in `packages/ui/legal.ts` is `null` until the owner chooses one; the footer and about page say the address is not yet published | The address is the owner's to pick; the placeholder is honest rather than invented |
| Licenses page | `apps/web/scripts/licenses.ts` writes `apps/web/generated/licenses.json` from `pnpm licenses list` before `dev` and `build`; the route renders it | docs/legal/attribution.md: generated at build from package metadata |
| Component screenshots in CI | Generated as artifacts, not compared pixel for pixel | Windows and Linux render fonts differently; a pixel diff would fail on every PR for the wrong reason |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Inter Tight and JetBrains Mono | Equal on the design document's list; Geist ships both faces in one package with `next/font` wrappers |
| Tailwind 3 with a JS config generated from `tokens.ts` | Tailwind 4 is current; its CSS theme is the generated artifact, with no second config format |
| Keeping Tailwind's default palette and relying on review | Every default class would be a token violation waiting to happen; resetting the namespaces makes the rule enforceable |
| A theme toggle with stored preference | Principle 3 says both schemes follow the system; a toggle is a later product decision |
| Storybook | A second toolchain for twelve components |
| Hand-written story props | Would hand-enter game data onto a page |
| Reading Postgres in Phase 0 through `packages/db` and PGlite | Adds the database to the request path before Neon exists; the pack is the same data |
| shadcn/ui primitives (ADR-001 "a project component library on shadcn/ui primitives") | The Phase 0 set needs no primitive beyond a dialog and a table; copying shadcn's Radix-based components would add dependencies and classes outside the tokens. Revisit when spec 02 needs popovers or menus |

## Consequences

- Every new visual value is a `tokens.ts` edit plus `pnpm --filter ui build:tokens`, plus an ADR.
- A Tailwind class that produces no CSS is the first sign of a value outside the tokens; the audit can grep the diff for `[` (arbitrary values) and the four allowed exceptions (`border-t-[3px]` for the brand rule, `max-h-[60dvh]` for the palette list, `bg-page/80` for the scrim, `aspect-video`).
- The gallery route exists in production builds so Playwright can screenshot it against `next start`; it is `noindex` and not linked from the navigation.
- When Meilisearch arrives (spec 02) the palette keeps its keyboard model and swaps `matchEntries` for a fetch.
- When the database arrives (spec 01 import job) `apps/web/lib/data.ts` becomes the query layer over `packages/db`; routes keep their props.
- The five Phase 0 e2e disclaimer routes are home, a ship, a component, the news feed and about; the author page joins when spec 03 creates it.
- `apps/web/lib/data.ts` also reads an optional `fixtures/news/ContentItem.json` so the feed can show real items before the pollers exist. No such file ships in Phase 0: on 2026-11-07 the Comm-Link RSS URL that the hub page advertises (`/comm-link/rss`, also `/en/comm-link/rss`) returned the hub's HTML page to a scripted fetch with a project User-Agent and to a real browser. The news feed and the home feed are therefore empty states, and spec 03 has to settle the news source before its poller is designed.
- The ship page lists hardpoints whose wiki type maps to a known port type or that carry a stock item; structural ports typed `other` with nothing mounted stay in the pack but are counted, not listed. Spec 02 decides the final hardpoint presentation.
