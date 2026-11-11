# ADR-052: The developer posts are "Developer gold posts"

- Status: accepted (owner direction 2026-11-11: "let's also call the featured posts/dev posts 'Developer Gold Posts' I think they call them gold posts in CIG/star citizen parlance")
- Date: 2026-11-11
- Deciders: owner, Claude Code session 2026-11-11
- Amends: ADR-029 (the news page's tab "Developer posts"), ADR-038 and ADR-050 (the front page's section "Featured developer posts"), system.md's Home and News rows, spec 06's "Hero home page" note

## Context

What CIG's staff write on Spectrum appears in two places: the news page's tab and page at `/news/dev`, "Developer posts" (ADR-029, ADR-035, ADR-037), and the front page's row, "Featured developer posts" (ADR-038, ADR-039, ADR-050). The owner wants the name players use: in the community's words, as he has it, a CIG staff post is a "gold post". The site's cards already carry Spectrum's yellow as their mark (ADR-032), so the name and the look agree.

## Decision

| Where | Was | Now |
| --- | --- | --- |
| The news page's tab | Developer posts | Developer gold posts |
| `/news/dev`: the page title and the masthead | Developer posts | Developer gold posts |
| `/news/dev` and the front page: the empty lines | No developer posts yet. ... | No developer gold posts yet. ... |
| The front page's section and its row's label | Featured developer posts | Developer gold posts |
| The front page's link to the page | All developer posts | All developer gold posts |

The name is in sentence case, "Developer gold posts", not "Developer Gold Posts" as the owner typed it in chat: CLAUDE.md section 7 puts every label in sentence case, and the owner's casing in a chat message was not a request to change that rule.

The front page drops "Featured". One name for one kind of post reads better than two, and the owner named both surfaces. Which posts the row shows, the threads staff opened first (ADR-039), and how many, are unchanged.

## What does not change

- The addresses: `/news/dev` and `/news/dev/<handle>`, which are published and stay put (CLAUDE.md section 5: slugs never change after first publish).
- The pages' content, their order, the author pages' titles ("<name> on Spectrum"), the cards, the feeds (which carry dispatches only, ADR-029) and the code's names (`DevPost`, `devPosts`, `dev-post-card.tsx`).
- Prose that describes the thing rather than naming the section, such as the about page's "every ship, manufacturer, news item and developer post gets a page".

## Alternatives considered

| Option | Why not |
| --- | --- |
| "Developer Gold Posts", as typed | Title case breaks CLAUDE.md section 7 |
| "Gold posts" alone | Players know the term, but a newcomer would not know whose posts they are; "developer" says who wrote them |
| Keep "Featured developer gold posts" on the front page | Four words before the noun, and two names for the same posts |
| Rename the addresses to `/news/gold` | Breaks published links and canonical URLs for a change of words |

## Consequences

- `apps/web/app/news/tabs.tsx`, `apps/web/app/news/dev/page.tsx` and `apps/web/app/page.tsx` change their labels; `e2e/news.spec.ts`, `e2e/home.spec.ts` and `e2e/devtracker.spec.ts` look for the new names.
- system.md's Home and News rows and spec 06's "Hero home page" note name the new heading. The earlier ADRs keep the old names as written; this record amends them.
