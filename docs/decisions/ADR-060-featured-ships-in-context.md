# ADR-060: Featured ships in context: a show's day, a new patch, CIG's own ship posts, a quiet week

- Status: accepted
- Date: 2026-11-14
- Deciders: owner ("can we make the featured ships more contextual to what is happening in game (e.g. RSI ships on RSi day on IAE/ILW, ships that are featured/being sold as part of an event (jumptonw etc) ships newly relaeased with existing one associated with it or that style odf play etc --- updating daily when there are big event moments and weekly in the normal cadence", 2026-11-13), Claude Code session 2026-11-13
- Amends: ADR-038 (the featured ships' daily draw), ADR-010 as the front page uses it (the showcase pair now holds the bento only in a quiet week), system.md's Home row, spec 06

## Context

ADR-038 gave the front page a bento of five ship cards: the owner's showcase pair (the RSI Perseus large and the Anvil Odin tall, ADR-010) and three ships drawn at random each UTC day from those with a picture. The draw knew nothing about the game. On 13 November 2026 IAE 2956 opened with Roberts Space Industries' day and the Galaxy, while 4.10.3 had just brought the Galaxy and the Liberator into the game, and the bento showed the Perseus, the Odin and three ships chosen by the seed. The owner asked for the featured ships to follow what is on: a maker's ships on its show day, the ships an event features or sells, a new ship with the ships it goes with or that play like it. The set should change daily at those moments and weekly otherwise.

What the pack holds that says what is on:

- **Shows** (ADR-057): `fixtures/events/` has each IAE, Invictus and CitizenCon day with its makers, its ships in RSI's order, the ship its banner names, and the limited hulls whose waves start on it.
- **Patches** (ADR-049): the LIVE snapshots in `fixtures/patches/` carry every ship record of each build and the day CIG released it. A record whose name and maker no record of the build before had is a new ship. A new record of a name already there is a variant (ADR-054): 4.10.3's second Caterpillar is not a new ship.
- **CIG's titles**: when CIG launches or promotes a ship it says so by name, maker first ("RSI Galaxy - Mission Made", "Kruger S-65 Stingray | Star Citizen", "Behind the Ships: RSI Galaxy", "Q&A: Aegis Sabre Raven EX and Argo ATLS IKTI Akuma").
- **The register**: each ship has its maker, its name and the pack's role ("Snub Fighter", "Medium Freight, Gunship"); each concept has RSI's focus ("Multi-Role / Light Carrier").

Some signals the pack does not hold. The pledge store's sale flags come through the wiki only now and then: two ships were marked warbond on 13 November, during a show that discounted many. In-game events such as Jump Town or the Vanduul Incursion name no ships in their titles. Comm-Link bodies carry no pledge links.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The rule | `featuredShips` in `apps/web/lib/featured.ts`, a pure function of the candidates, the moment, the show's day, the newest LIVE patch and the ships named in titles. `apps/web/lib/featured-sources.ts` reads those from the pack. The first that has a ship in the register decides: 1. a show's day; 2. the newest LIVE patch's new ships, for 7 days from the day CIG released it (`RELEASE_DAYS`); 3. the ships CIG named in a Comm-Link or video title within 7 days (`NEWS_DAYS`); 4. otherwise a quiet week | The owner's three examples, in the order a reader would expect them: a show is the biggest moment, a patch the next, a ship post the next. Deterministic, so every build at a moment agrees and a test can pin the moment |
| A show's day | The day the front page's hero leads with (`leadDay`: the one on now, the first from the show's eve). Its ships in RSI's order, the ship its banner names first, as on the hero (`dayBanner`). Then the day's limited hulls (with the Spectrum module on, as on the hero), then the day's ships CIG named in a title that week, then the rest of the day's ships in the day's draw. A day without a list (Best in Show) takes the whole show's ships | "RSI ships on RSI day": the schedule is RSI's own list, so the bento is the day's ships and nothing else while it has five. The banner's ship and the hulls on sale are what the day is about; the Skylark, launched with its own Comm-Link on Day 1, comes before the rest |
| A new patch | The register's entries for the records that brought a name (`newShips`; an edition is read as its entry), the ones CIG named in a title first. For 4.10.3: the Galaxy, then the Liberator | "Ships newly released"; the patch comparison already tells a new ship from a new variant (ADR-054) |
| A ship in the news | The ships a title names by maker and whole name, with nothing of a word either side; case counts, and the longer of two overlapping names wins (`shipsNamedIn`). The maker can be named by its code, its name or its name's first word ("RSI", "Roberts Space Industries", "Aegis"). Titles only, never a summary. Newest post first | "Ships that are featured/being sold as part of an event": CIG's launch and promotion posts lead with the ship's full name. Requiring the maker keeps out "the galaxy", "The Galaxy arrives" and "RSI Constellation Mk IV Celebration"; a summary's passing mention is not a feature |
| The ships that go with them | `companions`: after the leads, ships of a lead's line (same maker, same first word: the Constellations), then of its very role ("Snub Fighter"), then of its kind (the role's words without the size: any fighter, any freight), then by its maker. Each tier is taken a lead at a time, in an order seeded by the UTC day. Ships drawn for the day fill what is left | "With existing one associated with it or that style of play". The line and the role are the pack's own words, not a judgment of ours. Taking a lead at a time keeps one lead from taking every card |
| A quiet week | The showcase pair (ADR-010) and three ships drawn from those with a picture by a shuffle seeded with the UTC week, Monday to Sunday (`utcWeekNumber`) | "Weekly in the normal cadence"; the pair stays where nothing is on, as ADR-038 kept it |
| The pair at a moment | At a show, a patch or a ship post, the theme takes all five cards; the Perseus and the Odin appear only when they are part of it (the Perseus on RSI's day) | On RSI's day the Odin beside the Galaxy says nothing about the day. The pair is the owner's choice for the site's showcase (ADR-010), and it keeps its pages and the quiet weeks |
| Pictures | Only ships with a picture take part, every ship when none has one (CI has no media), as before | ADR-038's rule; CI keeps the layout |
| Saying why | The running head's label reads "Changes daily" at a moment and "Changes weekly" otherwise. At a moment, a line under the heading: "Day 1 of IAE 2956: Roberts Space Industries." with "All of the day's ships" linking the event page's `#today`; "New in 4.10.3: the Galaxy and the Liberator, with ships like them." with "What changed in 4.10.3" linking `/patches`; "In CIG's posts this week: the Galaxy and the Skylark, with ships like them." with "All dispatches" linking `/news`. Each card's note adds its reason after its role: "new in 4.10.3", "in the news", "limited today", "the Constellation line", "like the Liberator"; the live example keeps "the live example" | A set chosen for a reason says the reason, and each line leads into the section that has the rest |
| Freshness | The page is built with `now()` on every push to main: the news run's, every half hour when the pack changed (ADR-053), and the daily refresh's. A show day's ships change with the first build after the day turns, and a moment ends with the first build after its last day | As the hero and the lead story do (ADR-057, ADR-058) |
| Tests | `data-featured-theme` on the section and `data-why` on each card, for the e2e; unit tests on synthetic ships and on the committed 4.10.2 and 4.10.3 snapshots and the frozen IAE 2956 record | Published snapshots never change (CLAUDE.md section 2), so a test on them holds after the next patch |

## Alternatives considered

| Option | Why not |
| --- | --- |
| The pledge store's sale flags as the "being sold" signal | The wiki relays the store's state now and then, not daily: two ships were marked warbond on the first day of a show that discounted many. A ship's own launch post is the store's signal CIG publishes reliably |
| Ships named in Comm-Link summaries or bodies | Summaries mention ships in passing ("the much-anticipated modular Galaxy", with no maker), and the pack's recent bodies are short and carry no pledge links. Titles are where CIG names the ship it is featuring |
| A hand-kept table of in-game events and the play styles they suit (Jump Town to cargo and combat, the Vanduul Incursion to fighters) | It is an editorial judgment, not the pack's data (CLAUDE.md section 2). CIG's own words for an event name no ships, so the rule cannot know which ships it features. When CIG names a ship in an event's title, the news rule takes it |
| Keep the pair on every card set | On a show day the theme would have three cards, and the two largest would say nothing about the day |
| Change daily always, or weekly always | The owner asked for both: daily at the moments, weekly in between |

## Consequences

- `apps/web/lib/featured.ts` and `apps/web/lib/featured-sources.ts` are new; `apps/web/lib/front.ts` gains `shuffled` (the draw's seeded shuffle, which `dailyPicks` now uses) and `utcWeekNumber`; `apps/web/app/page.tsx` builds the bento from `featuredShips` and prints the line; `Bento` cards carry `data-why`.
- An in-game event the pack's titles do not tie to a ship (Jump Town, the Vanduul Incursion) leaves the bento to the other rules. A ship CIG sells without a post titled by its name waits for its post or its patch.
- A patch's new ships lead for a week whether or not CIG has posted about them. A ship whose record is renamed between builds reads as new for that week.
- The front page's bento no longer shows the Perseus and the Odin at every moment; their pages and showcases are unchanged.
