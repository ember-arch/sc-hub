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

## Alternatives considered

| Option | Why not |
| --- | --- |
| Client-side filtering with `useState` and `history.replaceState` | Works only after hydration and duplicates the filter logic on the client; the server render would show the unfiltered list first |
| Chip groups (one button per value) instead of selects | Five facets with up to dozens of manufacturers would fill the viewport on phone; a select scales and is keyboard-accessible for free |
| Sort as a query parameter | Every header tap would be a navigation; the spec asks only for filters in the URL |
| Faceted counts (how many ships each option would leave) | Useful at scale; with five ships it is noise, and the count line beside the title already says how many matched. Revisit when the import job brings the full matrix |

## Consequences

- Any new filter is a facet in `apps/web/lib/ship-filters.ts` (or `component-filters.ts`), a `FilterSelect` on the page and a case in the unit tests; the URL shape is the contract.
- The e2e suite reads expected values from `fixtures/bootstrap`, so a re-slug or a new pack changes the test data, not the test code.
- `/ships` joins `/`, `/ships/gladius` and `/news` in the Lighthouse budget.
- When Meilisearch arrives, the index can keep this URL shape and swap the in-memory filter for a search query.
