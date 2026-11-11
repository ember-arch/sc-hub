# ADR-035: Developer posts folded by default, the whole post across the card

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("we should utilize the full width of the bubble window for each post and we should be replicating the post (images too) as closely as possible. It should be easy to read and beautiful, perhaps even collapsed by default with the title, poster, date/how long ago, link to the spectrum thread, and the first few lines of text", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-032 (the post card), spec 03's "Dev tracker UI" note (the thread grouping of ADR-027's first version is withdrawn), system.md's prose measure for this one component

## Context

The tracker showed every post open, grouped by thread with the newest post of a thread open and the earlier ones folded, each post's prose at the reading measure (68 characters, system.md), which on a wide screen left the right half of every card empty. A year of staff posts, many of them long patch notes, made a page tens of thousands of pixels tall. The owner asked for folded cards, the whole width used, and the post reproduced as closely as possible, pictures included.

What the worker has today is the search answer's text (ADR-027): paragraphs, no formatting beyond line breaks, no pictures. The post's own blocks and pictures live behind Spectrum's thread endpoint, one more request per post at the five-minute spacing CLAUDE.md section 9 sets for Spectrum; that is a data path of its own, decided separately (ADR-036 when it is built), and this record covers the card.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| One card per post | The tracker is a flat list, newest first, twenty a page; the thread's title is the card's title, the author's name and role tag and the time follow, then the post's first lines. The grouping by thread goes: a folded card already says which thread a post belongs to, and two replies by one developer in one thread are two cards | The owner's list of what a folded card shows is per post; the grouping's reason, long threads of replies, is answered by the fold |
| Folded by default | A `details` element: the summary holds the title, the author, the time and the first lines (`excerptOf`, the sanitized body as plain text, cut at 280 characters on a word) with a plain cue, "Show the whole post"; opened, the fold hides the first lines and shows the post. The links to the post and its thread stand in a footer under the fold, outside the `details`, so they are visible either way (obligations.md: the source link never collapses) | The owner's "collapsed by default"; a tap opens; the browser's own element, keyboard-operable without script |
| The width | Open, the post runs across the card's width: `max-w-prose` is dropped on the post body, the one place the site lets prose exceed 68 characters. The posts are mostly lists, patch notes and short answers, which read as well wide; a long essay is rarer and the reader chose to open it | The owner's "utilize the full width"; recorded here as the exception to system.md's measure |
| What stays | The yellow rule and the role tag (ADR-032), the author pages (same cards, the author's name unlinked), the author chips, the pager, the records with Spectrum on | |
| Left as noted by the audit | The summary's accessible name is its whole content, title to first lines; the time sits under a title that wraps at 390 px; the first lines join a post's paragraphs with a space; an empty post's cue still offers to show it; CI runs the Spectrum-on records only locally | Each a small thing to take up with the pictures (ADR-036) |
| Pictures and blocks | Not in this change: they need the post's own content from Spectrum's thread endpoint, one request per post, five minutes apart, and the pictures copied and served like every other picture (ADR-009, ADR-034). ADR-036 records that path when it is built | The data is not on the pack yet |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the thread grouping and fold the threads | A thread's folded card would show one post's first lines for several posts; the owner's card is a post |
| A scripted accordion | `details` does it with no script, keyboard and screen readers included |
| Keep the 68-character measure and centre the prose | The owner asked for the width; the cards were half empty |

## Consequences

- `packages/ui/components/dev-post.tsx` takes `title`, `excerpt`, `threadUrl` and `open`; `thread` goes. `apps/web/lib/dev-posts.ts` gains `excerptOf`; `groupThreads` and `Thread` go with the grouping. The fold's marker and wrapping rules live in `apps/web/app/globals.css` (`.dev-post-fold`), so the card carries no arbitrary class.
- The tracker and author pages render the flat list; the records with Spectrum on change; the gallery's `DevPost` story opens its card so the record shows the post.
- Spec 03's "Dev tracker UI" note says what the tracker is now.
