# ADR-006: Ships UI on the fixture pack

- Status: accepted
- Date: 2026-11-07
- Deciders: owner (standing go-ahead to build spec 02 straight through on the fixture pack, 2026-11-07), Claude Code session 2026-11-07 (spec 02, criteria that need no Meilisearch, Neon, R2 or Vercel account)

## Context

Spec 02 asks for the reference experience: a filterable ship index, the full ship page, component pages, compare, slugs and redirects, SEO, performance and accessibility gates. The accounts it assumes (Meilisearch for the palette, R2 for images, Vercel for the preview) do not exist yet, and the data is still the bootstrap pack (five ships, one LIVE version, no PTU row, no paints, no variants, no `diff.json`). This record holds the decisions those criteria needed that ADR-005 does not already cover. It grows with each spec 02 PR; every row names the PR that made it.

## Decisions

### Ship index and component index (PR 4)

| Concern | Choice | Reason |
| --- | --- | --- |
| Filters as URL state | A GET form (`FilterBar`) of native `<select>`s. Every filtered view is a plain URL (`/ships?manufacturer=aegis-dynamics&size=small&view=table`); the server renders the result from the query string. With JavaScript, a change submits the form and the page navigates client-side to the URL a plain GET would reach, minus fields left at "no filter"; without JavaScript an Apply button inside `<noscript>` submits the same form | The spec says filters are URL state and the design document says search is the navigation, so a filter must be shareable and work before hydration. Native selects are keyboard-operable and need no popover primitive (ADR-005 deferred those) |
| Facet values | Manufacturer: the manufacturer's slug (the code when the pack lacks the row). Role: each comma-separated ship-matrix role, kebab-cased (`light-freight`). Size: the size class as stored. Status and kind: the enumeration values. Options are every value present in the whole index, labelled from the data, not from a typed list | Values derive from the pack (CLAUDE.md section 2: never hand-enter game data). Slugs and kebab roles read as URLs; enumeration values are already lower-case identifiers. Offering the full set lets a reader widen a search without clearing it |
| Sort | Client state in `DataTable` (name ascending by default, any stat column on tap), not a query parameter | The spec puts filters, not sort, in the URL. A sort is a reading preference inside one result set; keeping it in the table avoids a server render per tap and keeps `/ships?view=table` canonical |
| Ship table columns | Fixed set: name, manufacturer, role, size, crew, cargo (SCU), length (m), mass (kg), SCM speed (m/s), status. Name and cargo stay visible on phone; the rest live in the expanded row | system.md principle 6: fixed columns, units in the header. Cargo is the stat the card already leads with, so phone users see the same two facts in both views |
| View toggle | `view=table` in the query string, switched by `SegmentedLinks` (two links, `aria-current` on the active one); the default view leaves no parameter | URL state for the same reason as the filters; links rather than buttons so the choice survives reload and sharing without JavaScript |
| Components index | Size and manufacturer filters on the same `FilterBar`; the type grouping and its anchor chips stay, and the chips hide when one group remains | The spec names those two filters; type is already the grouping and would duplicate the chips |
| Rendering | `/ships` and `/components` read `searchParams`, so they render per request from the in-memory pack | The pack is in process memory (ADR-005); a per-request render of five ships costs nothing measurable, and the pages stay static-shaped for Lighthouse |
| New components | `FilterBar` (with `FilterSelect`) and `SegmentedLinks` join `packages/ui` with light and dark stories | system.md section 3 is the Phase 0 set; spec 02 is the first spec that needs a filter control and a view switch |
| When a select applies | A pointer pick applies at once. Arrow, Home, End and Page keys on a focused select change its value without applying; Enter or leaving the control applies the change. The navigation keeps scroll and focus (`router.push` with `scroll: false`) | Applying on every `change` made arrow keys navigate on each step and lose focus (WCAG 3.2.2, the audit of PR 4); the no-JavaScript path still submits with the Apply button |
| Size order | `sizeClassOrder` and `sizeClassRank` live in `packages/schema/enums.ts`; the size facet and the table's size column sort by rank, not alphabetically | One list for the pipeline and the UI; `size_class` stays a free string so a class CIG adds does not halt an import (it ranks last) |
| Manufacturer facet value | The manufacturer's slug only; a ship whose manufacturer row is missing (impossible in a valid pack) offers no option and matches none | The code must not become a URL value that changes to the slug later; slugs are stable |
| Card grid | 2 / 3 / 4 columns by breakpoint on the index, the manufacturer lineup and related groups | system.md section 4 names that grid for the index; one rule for every card grid |
| Hover transitions | `transition-colors duration-hover` on controls and cards is the 120 ms hover duration system.md section 2 defines | CLAUDE.md section 7 ("motion only for viewer transitions and loading states") reads as no ambient or decorative animation; a hover color change is state feedback, used by `Card` since Phase 0. Recorded so the two documents are read together |
| Table caption | The ships table caption names the LIVE build | A screen-reader user hears the version the numbers come from without the count line |

### Ship page and component page (PR 5)

| Concern | Choice | Reason |
| --- | --- | --- |
| Specs by channel | One "Specifications" section showing LIVE values with the LIVE version in the aside. `channelDeltas` (`apps/web/lib/channel-diff.ts`) returns PTU minus LIVE for every numeric field that differs; `StatsByChannel` shows a "Show PTU differences" toggle only when a current PTU build has a differing row for the entity, and reveals the deltas through `StatRow` (arrow glyph plus color, never color alone) | CLAUDE.md section 5: LIVE is canonical and PTU displays as a diff, never as the default. The toggle is client state, not a query parameter: it changes how one section reads, not which page is shown |
| PTU states | No PTU build: a one-line note under the stats. PTU build but no row for this entity: a note naming the build. PTU row equal to LIVE: the design document's "No PTU differences for this version." empty state | Every state names the space and the next step (system.md section 5) rather than hiding the section |
| The same component for items | The component page builds its stat list from one `ItemStats` field table (null fields omitted) and uses `StatsByChannel` too | One channel model for ships and components; the type-specific fields are null for other types by the data model's own rule |
| Variants and paints | The repository groups ships into variant families (a base plus every ship whose `base_variant_of` chain reaches it) and attaches `Paint` rows per ship. Variants render as cards under a heading that names the base; paints as a chip list of names, with no preview until R2 exists | Both are data-model entities with no pipeline yet; the bootstrap pack has none, so the section shows an empty state and the logic is tested over synthetic rows |
| Changed in this version | An empty state saying there is no earlier LIVE version to compare against | `diff.json` has no shape until spec 01's "Diff" criterion; inventing one in the web app would be a contract made on the wrong side of the boundary |
| Fuel fields | Two decimals, no unit | The data model gives `hydrogen_fuel`, `quantum_fuel`, `hydrogen_capacity` and `quantum_capacity` no unit; showing a guessed one would be an inference. Spec 01's normalizer should name the unit and the data model gain it |
| Stock loadout | Panels by system (weapons; defense; power and cooling; flight; sensors and utility; cargo) built from the port tree by `apps/web/lib/loadout.ts`: identical sibling ports merge with a count, a turret's or rack's items stay nested beneath it, each mounted item links to its page, empty ports close each list, and one headline number (weapon damage, shield health) shows when the pack has it. The raw per-port table stays behind a "All N ports by game name" disclosure | The owner's reading of the first version: a flat table of game port names read like a spreadsheet. The idea of grouping a loadout by system is FleetYards' (feature ideas are fair game, CLAUDE.md section 2; no code was read or copied); the panels are this design system's tokens and components. Nested ports and item links (the spec's words) are kept in both views. Headline numbers stop at the two whose scale reads without a unit because the data model names none for item stats |
| Error boundary | `apps/web/app/error.tsx`: one sentence, a retry and a home link, and the footer with the verbatim notice; the patch strip shows its empty state because a client boundary cannot read the pack | Deferred from the ADR-005 audit; CLAUDE.md section 2 says no page ships without the disclaimer |

### Compare and the keyboard run (PR 6)

| Concern | Choice | Reason |
| --- | --- | --- |
| Source of truth | `/compare?ships=a,b,c,d` is the comparison. The page resolves the slugs, names any unknown slug and any past the fourth and leaves them out, and renders the rest. Remove is a link to the URL without that ship; the add select submits `add=` and the page redirects to the canonical URL with the ship appended | The spec says shareable by URL; one URL per comparison, no state the link does not carry |
| The basket | The Compare toggles on the ship page hero, under each index card and in a table column keep a list of slugs in local storage (try/catch, like the palette's recents) through `useSyncExternalStore`, with an empty server snapshot so the first client render matches the server. "Compare N ships" links to the compare URL for the basket; the compare page writes its URL back into the basket | Add and remove from the ship page and the index need a place to collect ships across navigations; a server session is more than a reference site should hold. The write-back keeps a shared link and the toggles agreeing |
| Phone layout | A table with one column per ship on md and up; on phone each stat becomes a block with the ships' values in a two-column grid. Both are server-rendered; one is hidden per breakpoint | system.md principle 6: no sideways scroll. Four ship columns cannot expand row by row the way a list can |
| Row set | The key-facts set first (manufacturer, role, size, crew, cargo, length, mass, status), then the rest of VehicleStats; a row every ship lacks is omitted | The spec names the key-facts set and the full stats table; spec 02 notes say omit null rows |
| Robots | `noindex, follow` on every compare URL | Each selection is its own URL; the pages are for sharing, not for search engines, and would index as near-duplicates |
| Keyboard run | One Playwright test drives the index (filters, cards), a ship page (compare toggle, link), compare (add select, remove link) and the palette with Tab, arrows, Enter and Space only, and checks a visible outline at every stop | The accessibility criterion asks for the run recorded as a test; the focus-ring check turns system.md section 6 into an assertion |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Client-side filtering with `useState` and `history.replaceState` | Works only after hydration and duplicates the filter logic on the client; the server render would show the unfiltered list first |
| Chip groups (one button per value) instead of selects | Five facets with up to dozens of manufacturers would fill the viewport on phone; a select scales and is keyboard-accessible for free |
| Sort as a query parameter | Every header tap would be a navigation; the spec asks only for filters in the URL |
| Faceted counts (how many ships each option would leave) | Useful at scale; with five ships it is noise, and the count line beside the title already says how many matched. Revisit when the import job brings the full matrix |
| PTU toggle as `?channel=ptu` | A shareable PTU view would present PTU values as a page of their own, which CLAUDE.md section 5 forbids; the toggle only annotates LIVE |
| Compare state in a server session or cookie | A cookie per reader for a basket of four slugs is state the privacy page would have to explain; local storage stays on the device |
| Compare as part of the ships index (`/ships?compare=a,b`) | Two pages in one URL space; the comparison deserves its own address |
| A story for `StatsByChannel` with deltas | The story would need PTU values the pack does not have; typed deltas are hand-entered game data. The unit test over a synthetic PTU copy of a fixture row covers the logic |

## Consequences

- Any new filter is a facet in `apps/web/lib/ship-filters.ts` (or `component-filters.ts`), a `FilterSelect` on the page and a case in the unit tests; the URL shape is the contract.
- The e2e suite reads expected values from `fixtures/bootstrap`, so a re-slug or a new pack changes the test data, not the test code.
- `/ships` joins `/`, `/ships/gladius` and `/news` in the Lighthouse budget.
- When Meilisearch arrives, the index can keep this URL shape and swap the in-memory filter for a search query.
