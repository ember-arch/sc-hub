# ADR-058: The lead story: a picture-led hero at the top of the front page outside a show

- Status: accepted
- Date: 2026-11-12
- Deciders: owner ("instead of this text block we make this the hero block for this event and then after it, the space becomes a image-based hero block for the most relevant news, video, or post etc that updates daily or every couple fo days", 2026-11-12), Claude Code session 2026-11-12
- Supersedes: ADR-042 (the daily line); the contents list of ADR-020 and ADR-046 on the front page
- Amends: ADR-038 (the top of the front page), system.md's Home row, spec 06

## Context

The top of the front page was a text block: the date, the daily line (ADR-042, two clauses composed from the pack) as the page's title, and the numbered contents beside it (ADR-020; hidden on phones since ADR-046). ADR-057 put a show's hero in that place while a show runs. The owner asked for the same space, outside a show, to become a picture-led hero for the most relevant dispatch, video or post, changing daily or every couple of days.

What the pack holds that can lead with a picture: Comm-Links, with RSI's hub cover in the media manifest (ADR-029, ADR-051; 960 px at most); CIG's full videos, with YouTube's thumbnails (ADR-050; 480 px is all YouTube promises for every upload); developer posts, which carry pictures only when staff attached some (ADR-037), none on the manifest today. The pack holds no votes, views or categories that measure what is "most relevant", only the source, the title, the time and the text. Twelve days of the pack before 12 November show the pattern: a Comm-Link or two most days, a full video every few days, Shorts in between, and store promotions ("Monthly Store Bundle 2026", "November 2026 Subscriber Promotions", "Twitch Drops: IAE 2956") among the Comm-Links.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| What can lead | A Comm-Link or a full video (no Shorts, as on the front page's video row) | They carry the pictures; a developer post leads in the tracker's section, where it has its own surface |
| Which one | `leadStory` in `apps/web/lib/front.ts`: from those published before today's UTC day began, the latest day that has any; on that day a Comm-Link before a video, the newest first, the title breaking a tie | "Updates daily or every couple of days": the choice is fixed for the UTC day and moves when a newer day has a story, so a quiet stretch keeps the last one; a Comm-Link has the larger picture and the words; the rule is deterministic, so every build on a day agrees |
| Promotions | A title CIG writes as a store promotion (store, bundle, sale, promotions, subscribers, Twitch drops, giveaway, referral: `PROMOTION`) does not lead while anything else is on the pack; it stays in the dispatches | The owner's "most relevant"; a store bundle is news of a kind, not the lead. The words are CIG's own and the list is short and visible in one place, for the owner to change |
| Pictures | Only candidates with a picture take part, all of them when none has one (CI has no media), as the bento's daily picks do (ADR-038) | The owner's "image-based"; CI keeps the layout |
| A Comm-Link and its video | A full video whose title is the lead Comm-Link's (CIG's "Star Citizen \| " prefix and punctuation aside) within three days rides along: "Play the video" opens the front page's player in place (ADR-050) and "Watch on YouTube" leaves | "Behind the Ships: RSI Galaxy" is both; one story, two ways in |
| The card | `FrontLead`, `apps/web/app/front-lead.tsx`, under the date: one rounded card with the lift shadow, the picture at 16:9 on the left (three fifths for a cover, half for a video's 480 px thumbnail, so it is not drawn far past its size; on top on a phone), then the label line ("Lead story", the source or channel, the time), the title as the page's title in `title`/`display` (the daily line's sizes) linked to its source, the excerpt cut to four lines, the links as pills (Read on RSI in the accent's selected state; Play the video; Watch on YouTube) and the credit. The picture loads with priority and the page preconnects to its host | The front page's existing grammar: the dispatch card's parts, the ship file's lift, no new token |
| Repetition | A Comm-Link lead is left out of the dispatches' carousel below it; the videos' row stays whole | The five newest dispatches stay five other ones; the pack holds few full videos, and a row of three would lose its carousel |
| An empty pack | The site's tagline as the title | A page always has its title |
| The daily line and the contents | Retired from the page and the code (`dailyLine`, `freshestStaffWord`, the headline helpers, `CONTENTS` and `Contents`, with their tests); the header's sections are the way into the site, as on every other page | The owner replaced the text block; code nothing calls is not kept |
| A show | ADR-057 is unchanged: while a show runs its hero stands here instead | One hero at a time |

## Alternatives considered

| Option | Why not |
| --- | --- |
| The newest item, whatever its day | Changes with every news run, several times a day; the owner asked for daily or every couple of days |
| A fixed rotation (a different item each day) | Would lead with something older than what is on the pack when news is busy |
| Rank by a measure of interest | The pack has none: no views, votes or replies for Comm-Links and videos |
| Keep the daily line as a line under the lead | The owner asked for the text block to go; two titles would compete |
| Full-bleed picture with the words on the scrim, as the show's hero | RSI's covers are 960 px and YouTube's thumbnails 480 px; drawn across the page they would be soft. The show's hero draws the register's ship pictures at up to 5,120 px |
| Developer posts as candidates | No picture on the manifest; the tracker's section already features them |

## Consequences

- `apps/web/lib/front.ts` gains `LeadCandidate`, `storyKey`, `PROMOTION`, `LEAD_PAIR_DAYS` and `leadStory`, unit-tested in `__tests__/front.test.ts`, and loses the daily line's and the contents' helpers; `apps/web/app/front-lead.tsx` is new; `apps/web/app/front.tsx` loses `Contents`.
- `home.spec.ts` checks the lead story (its title linked to RSI or YouTube, published before today, absent from the carousel, no contents) in place of the daily line and the contents; `devtracker.spec.ts` checks that the page's title is the lead story's or a show's; the home records change.
- The lead moves at the first build of a UTC day that has a newer story: in practice the daily refresh's commit after 06:23 UTC, or the first news run that lands anything. A day with no build keeps the previous lead, as ADR-038 says of the featured ships.
- ADR-042 is superseded; system.md's Home row and spec 06 say what the top of the front page is now.
- A video lead's picture is YouTube's 480 px thumbnail; a larger one is not promised for every upload (ADR-050). A Comm-Link leads on most days.
