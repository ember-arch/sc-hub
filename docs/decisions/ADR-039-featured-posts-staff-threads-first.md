# ADR-039: Featured developer posts: the threads staff opened first, then the threads they answered in, by likes

- Status: accepted
- Date: 2026-11-11
- Deciders: owner ("For the featured spectrum posts -- favor threads authored by CIG staff first -- then when there aren't 5 of those in the past 48-72 hours move to posts within threads that they didn't author ranked by most interactions/likes on the comments/post", 2026-11-11), Claude Code session 2026-11-11
- Amends: ADR-038 (the featured-post rule), system.md's Home row

## Context

ADR-038 chose "top" for the front page's featured developer posts as recency by thread: the posts of the last 48 hours, one per thread, newest first, because the pack carries no votes or reply counts. The owner's refinement: a thread CIG staff opened (patch notes, an FAQ, an announcement, a contest) is the stronger hook than a staff reply inside a player's thread, and among the replies the ones readers liked most should come first.

What the pack can tell: a thread staff opened has its opening post on the pack, and that post's address is the thread's own page (no post number on it), as `threadUrl` in `apps/web/lib/dev-posts.ts` already reads it. On 2026-11-10 the pack held 168 opening posts among 519, and three of the seven threads with a staff post in the last 48 hours were staff-opened. What it cannot tell yet: likes. Spectrum's thread endpoint answers each post's votes and reactions, and the worker strips them (ADR-037), since content items are append-only revisions (CLAUDE.md section 5) and a count that changes by the hour is not a revision.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Tiers | `featuredPosts` in `apps/web/lib/front.ts` picks one post per thread (the thread's newest), five at most: first the threads staff opened with a staff post in the last 48 hours, newest first; when fewer than five, the same reaching back to 72 hours; then the threads staff only answered in, within 72 hours, by likes where the pack records them and newest first otherwise; when fewer than three in all, the newest remaining threads fill the list to three, as before | The owner's order, with ADR-038's floor kept so the section never empties |
| Staff-opened | A thread whose opening post is on the pack: a post whose address has no post number. The pack holds only staff posts, so an opening post on it was staff's | The same reading of the address as `threadUrl`; nothing new on the pack |
| Likes | `FeaturedCandidate.likes`, optional, read when present and ignored when null or absent. Until the worker records likes the second tier is by recency; recording them is a worker change in its own PR (CLAUDE.md section 6: pipeline or worker and web are two PRs), as a side file keyed by post id next to `thread-state.json`, not a revision of the content item | The rule is ready for the data; the data path is decided when it is built |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Read the author's role to tell an announcement from a reply | Every post on the pack is staff's; what distinguishes the tiers is who opened the thread, which the address tells |
| Put likes on `ContentItem` as a revision | A count that moves hourly would revise every post every run; the pack is append-only by design |
| Wait for likes before changing the rule | The first tier needs no likes and is the owner's main point |

## Consequences

- `featuredPosts` gains `FEATURED_REACH_HOURS` (72) and the tiers; `FeaturedCandidate` gains optional `likes`. Unit tests cover each tier and the fill. The page does not change: it hands the same rows in.
- system.md's Home row says what the featured posts are now; ADR-038's row stands as the first version.
- The Spectrum-on home records change where the order does.
- Follow-up, its own PR: the Spectrum worker records likes (and reply counts) per post in a side file the site reads into `likes`; until then the second tier is by recency.
