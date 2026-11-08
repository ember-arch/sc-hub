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
| Ship table columns | Fixed set: name, manufacturer, role, size, crew, cargo (SCU), length (m), mass (kg), SCM speed (m/s), status, and (since PR 6) a Compare toggle. Name and cargo stay visible below the table's breakpoint (xl since ADR-007); the rest live in the expanded row, with a "Sort by" select for them | system.md principle 6: fixed columns, units in the header. Cargo is the stat the card already leads with, so phone users see the same two facts in both views |
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
| Loadout merge key | Sibling ports merge when they carry the same part by the item's type, display name, size and subtype, not its class name; a merged entry links to the first class and lists every class it stands for. Two same-named entries at one level show their subtype (`QuantumFuel` → "Quantum fuel") | The game gives a left and a right rack their own class names, and a hydrogen and a quantum tank one display name; the subtype is the field that tells the tanks apart (the audit of PR 5). The per-port table keeps every class linked on its own row |
| Panel coverage | `GROUP_OF` is typed `Record<PortType, GroupId>` | A port type CIG adds fails the build until it has a panel, instead of landing in none |
| Stock loadout | Panels by system (weapons; defense; power and cooling; flight; sensors and utility; cargo) built from the port tree by `apps/web/lib/loadout.ts`: identical sibling ports merge with a count, a turret's or rack's items stay nested beneath it, each mounted item links to its page, empty ports close each list, and one headline number (weapon damage, shield health) shows when the pack has it. The raw per-port table stays behind a "All N ports by game name" disclosure | The owner's reading of the first version: a flat table of game port names read like a spreadsheet. The idea of grouping a loadout by system is FleetYards' (feature ideas are fair game, CLAUDE.md section 2; no code was read or copied); the panels are this design system's tokens and components. Nested ports and item links (the spec's words) are kept in both views. Headline numbers stop at the two whose scale reads without a unit because the data model names none for item stats |
| Key facts version | One caption under the hero name, "Key facts and stats from LIVE <build>" | The spec says every stat shows the version it comes from; the key-facts block has no aside of its own |
| Stock on | A section with ship cards between the stats and the news, not a related group | system.md section 4 orders the component page stats, stock on, in the news |
| Capital ship in the budget | `/ships/polaris` joins the Lighthouse routes | The hidden per-port table is largest on capital ships; the budget gates DOM size where it is worst |
| Error boundary | `apps/web/app/error.tsx` and `global-error.tsx`: one sentence, a retry and a home link, and the footer with the verbatim notice; the patch strip shows its empty state because a client boundary cannot read the pack | Deferred from the ADR-005 audit; CLAUDE.md section 2 says no page ships without the disclaimer |

### Compare and the keyboard run (PR 6)

| Concern | Choice | Reason |
| --- | --- | --- |
| Source of truth | `/compare?ships=a,b,c,d` is the comparison. The page resolves the slugs, names any unknown slug and any past the fourth and leaves them out, and renders the rest. Remove is a link to the URL without that ship; the add select submits `add=` and the page redirects to the canonical URL with the ship appended | The spec says shareable by URL; one URL per comparison, no state the link does not carry |
| The basket | The Compare toggles on the ship page hero, under each index card and in a table column keep a list of slugs in local storage (try/catch, like the palette's recents) through `useSyncExternalStore`, with an empty server snapshot so the first client render matches the server. "Compare N ships" links to the compare URL for the basket; the compare page writes its URL back into the basket | Add and remove from the ship page and the index need a place to collect ships across navigations; a server session is more than a reference site should hold. The write-back keeps a shared link and the toggles agreeing |
| Phone layout | A table with one column per ship on md and up; on phone each stat becomes a block with the ships' values in a two-column grid. Both are server-rendered; one is hidden per breakpoint | system.md principle 6: no sideways scroll. Four ship columns cannot expand row by row the way a list can |
| No sort | The compare table has no sort control; its caption names the LIVE build | It is transposed (stats down, ships across): sorting ships by one stat would reorder columns, and the reader already chose the order through the URL |
| Missing values | A row every ship lacks is omitted; a ship missing a stat the others have shows an em dash with hidden text "no value" | Spec 02 notes say omit null rows; a dash keeps the columns aligned where only one ship lacks the stat, and the hidden text keeps it from reading as "em dash" |
| Row set | The key-facts set first (manufacturer, role, size, crew, cargo, length, mass, status), then the rest of VehicleStats; a row every ship lacks is omitted | The spec names the key-facts set and the full stats table; spec 02 notes say omit null rows |
| Robots | `noindex, follow` on every compare URL | Each selection is its own URL; the pages are for sharing, not for search engines, and would index as near-duplicates |
| Keyboard run | One Playwright test drives the index (filters, cards), a ship page (compare toggle, link), compare (add select, remove link) and the palette with Tab, arrows, Enter and Space only, and checks a visible outline at every stop | The accessibility criterion asks for the run recorded as a test; the focus-ring check turns system.md section 6 into an assertion |

### Slugs and SEO (PR 7)

| Concern | Choice | Reason |
| --- | --- | --- |
| Old slugs | `resolveSlug` (`apps/web/lib/slugs.ts`) checks current slugs first, then every ship's `slug_history`; the ship page answers a moved slug with Next's `permanentRedirect` (its Open Graph route prerenders only current slugs, `dynamicParams = false`, so an old slug's card 404s while the page redirects), and the compare page redirects a list with any old slug to the canonical URL of current ones. Unknown slugs 404 with the search box | docs/data-model.md "Slugs and redirects". Next's permanent redirect is 308 rather than the spec's 301: the same permanent signal to browsers and crawlers for a GET, and it keeps the method for anything else; a bare 301 would need a route handler or proxy in front of every entity route |
| Public origin | `SITE_URL` joins CLAUDE.md section 9 and `env.ts` (optional); the root layout's `metadataBase` reads it, falling back to Vercel's production URL and then the local dev origin; a Vercel production deploy with neither throws at build | The domain is undecided until the name is (CLAUDE.md section 12), so no origin is baked in; every canonical, sitemap and Open Graph URL derives from one place |
| Canonical URLs | Every page declares `alternates.canonical`: the unfiltered index for `/ships` and `/components` (filters are views, not pages), the bare `/compare` for the noindex permutations, each entity's own path otherwise | One address per page for crawlers; filter and compare URLs stay shareable without becoming duplicates |
| Sitemap and robots | `app/sitemap.ts` lists every indexable route, with the LIVE build's publish time as lastModified on entity pages; `app/robots.ts` disallows the gallery and names the sitemap; compare is not disallowed, because its `noindex` is only seen if a crawler may fetch it | The entity pages change only when a version is imported; compare and gallery are not for indexing |
| JSON-LD | Ships as schema.org `Vehicle` (name, URL, manufacturer as `Organization`, role as category, mass in kilograms, cargo with `unitText` SCU, and the channel and build as `additionalProperty`; crew is left out because schema.org has no crew property and seating capacity is a different fact; no `sameAs`, which would assert identity with CIG's site), manufacturers as `Organization`; fields come from the pack and anything it lacks is left out. Rendered through one `JsonLdScript` component that escapes `<` | The spec names ships and manufacturers; schema.org has no closer type for a fictional spacecraft than Vehicle, and nothing is typed in |
| Open Graph images | `app/ships/[slug]/opengraph-image.tsx` draws a 1200 by 630 card from the tokens (dark page color; caption, display and body sizes scaled for the card; Geist Medium read from the geist package; only current slugs, prerendered). When a pipeline thumbnail exists the card becomes `openGraph.images` pointing at the CDN URL, never fetched inside this route, so the thumbnail is not routed through the app server with the ship name, manufacturer and role, generated at build for every ship | The spec wants the pipeline thumbnail or the fankit render; neither exists (no R2, fankit not downloaded). A static placeholder from the tokens gives every share a card without an image the project does not have, and the file is served static, not routed through the app server |

### Design review (PR 7)

The KICKOFF design-review prompt ran in a subagent over home, the Gladius, the Polaris, a component page and compare, at 390 px and 1280 px in both schemes. Tokens, decoration, the phone table rule and the disclaimer passed on every page; LCP was 0.9 to 1.06 s. What changed in response:

| Finding | Change | Reason |
| --- | --- | --- |
| News sections on ship, component and manufacturer pages | Removed | Spec 02 "Out of scope": Phase 3 adds news and dev posts to entity pages. An empty section ahead of its phase is an element the reader can lose |
| Empty states written for the operator ("data pack", "pipeline publishes", "PTU pack is imported") | Rewritten for the reader, with a next step where one exists ("The ship index lists every hull", "browse the ships") | system.md section 5: empty states name the space and the next step |
| Key facts printed an em dash for a missing value | A null fact is left out | Spec 02 notes: omit the row; the block collapses gracefully |
| Crew, length and mass in the key facts (and crew on compare) set in the interface face because they arrive preformatted | `KeyFact.numeric` and `CompareRow.mono` set them in mono | system.md principle 2: one mono for numbers, tabular figures |
| The compare phone stack inherited the browser's 16 px | `text-ui` on the stack | system.md section 2: only token sizes |
| Loadout panels stretched to the tallest in their row (530 px for two lines on the Polaris) | `items-start` on the grid | Chrome without content |
| The game's "UNDEFINED" subtype and subtypes that repeat the item name ("Manned turret") | Not shown | They tell the reader nothing |
| "<= PLACEHOLDER =>" as a link in the loadout | Reads "Unnamed thruster" (the port type); the component page keeps the pack's own name | It is the wiki's marker for a missing localized name, not a name. Spec 01's normalizer should name these parts from localization |
| Cards drew an empty grey image well | No well without an image | An empty box on every card is chrome; the image returns when the fankit or pipeline thumbnails exist |
| Home: an h1 and a tagline above the search field; the search field at the body size | The h1 is visually hidden, the tagline lives in the meta description only, the field uses the ui size, the feed's aside is gone | system.md section 4: search field as the first element; controls use `ui` |
| The viewer placeholder said "Render placeholder until the fankit image or the 3D viewer lands" with no padding | It says "No image yet", padded and centered | Copy for the reader, not the operator |

Recorded for the owner, not changed (each is a design-document or token decision); the owner decided all of them on 2026-11-07, see ADR-007:

| Finding | Why it waits |
| --- | --- |
| Light-mode accent contrast: `#2F6BFF` measures 4.19:1 on `bg.page` and 3.90:1 on `bg.inset`, under the 4.5:1 system.md section 6 asks for text; `success` and `warning` are under it too (PTU deltas in light mode, once a PTU build exists). `#2560E8` would measure about 5.0:1 on `bg.page`, 4.65:1 on `bg.inset` and 5.4:1 on white | A token change needs an ADR and is the owner's design call, like the `text.muted` question in ADR-005. Local Lighthouse runs scored 1.00 because the machine's system scheme is dark |
| Labels in capitals that are not units: "SCM speed", "NAV speed", "EM signature", "LIVE", "PTU" | They are the game's own acronyms; system.md section 2 allows only unit abbreviations in capitals, so the owner rewords the rule or the labels |
| Duplicates the spec asks for: manufacturer and status in both the hero and the key facts; length, mass, cargo and crew in both the key facts and the specifications (the specifications are where their PTU deltas show) | Spec 02 lists both; dropping either is a spec change |
| Showing or hiding the placeholder viewer slot and empty sections ("Variants and paints", "Changed in this version") until data exists | Spec 02 asks for the slot and the sections; the fankit download (spec 00 prerequisite) fills the slot |
| The footer line "SC Hub is a non-commercial fan project." and the patch strip shown both on home and in the footer | system.md section 3 asks for both strips; the footer line is not required by docs/legal/obligations.md |
| "Three sizes per page" against the six-role type table | Already open in ADR-005 |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Client-side filtering with `useState` and `history.replaceState` | Works only after hydration and duplicates the filter logic on the client; the server render would show the unfiltered list first |
| Chip groups (one button per value) instead of selects | Five facets with up to dozens of manufacturers would fill the viewport on phone; a select scales and is keyboard-accessible for free |
| Sort as a query parameter | Every header tap would be a navigation; the spec asks only for filters in the URL |
| Faceted counts (how many ships each option would leave) | Useful at scale; with five ships it is noise, and the count line beside the title already says how many matched. Revisit when the import job brings the full matrix |
| PTU toggle as `?channel=ptu` | A shareable PTU view would present PTU values as a page of their own, which CLAUDE.md section 5 forbids; the toggle only annotates LIVE |
| A 301 through `next.config` redirects or a proxy | Config redirects are fixed at build and cannot read `slug_history`; a proxy in front of every entity route would load the pack on every request to serve a rare redirect |
| Compare state in a server session or cookie | A cookie per reader for a basket of four slugs is state the privacy page would have to explain; local storage stays on the device |
| Compare as part of the ships index (`/ships?compare=a,b`) | Two pages in one URL space; the comparison deserves its own address |
| No story for `StatsByChannel` with differences | Considered in PR 5 because a typed PTU value would be hand-entered game data; the audit noted the unit tests already use a synthetic copy of a fixture row. The story now renders the component with a PTU row that is the LIVE row plus one on every stat, named as such, so the toggle's open state has a screenshot without inventing a game number |

## Consequences

- Any new filter is a facet in `apps/web/lib/ship-filters.ts` (or `component-filters.ts`), a `FilterSelect` on the page and a case in the unit tests; the URL shape is the contract.
- The e2e suite reads expected values from `fixtures/bootstrap`, so a re-slug or a new pack changes the test data, not the test code.
- `/ships` joins `/`, `/ships/gladius` and `/news` in the Lighthouse budget.
- When Meilisearch arrives, the index can keep this URL shape and swap the in-memory filter for a search query.
