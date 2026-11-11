# ADR-050: CIG's videos on the news page and the front page, and the front page's sections as rows that scroll sideways

- Status: accepted (owner direction 2026-11-11: "create a page and a section on the home page of star citizen's and squadron 42's latest videos linking to their Youtube ... a 5-7 video scroll with the video thumbnail; great if we can open the youtube video onsite in like a popout shadow box, but if not linking over to the youtube video itself is fine. Let's also turn featured developer posts into a smaller side-scroll gallery, rather than big verticals. If it's best practice let's particularly optimize homepage modules/sections this way to allow folks on mobile to more easily navigate through the homepage without getting stuck in a massive scroll"; then "while the videos have their own section on the homepage, they should be part of the broader news page, a third tab on it")
- Date: 2026-11-11
- Deciders: owner, Claude Code session 2026-11-11
- Amends: ADR-027 (the video poller it deferred), ADR-029 (the news page's tabs), ADR-038 and ADR-046 (the front page's sections), ADR-044 (three places for icons), spec 03's "Video poller" criterion, system.md's Home and News rows, `docs/legal/obligations.md` (YouTube as the one third party)

## Context

Spec 03 always meant the news feed to carry CIG's videos ("RSI YouTube channel RSS hourly; items link to YouTube, never embed autoplay"), and `ContentSource` has had `video` since Phase 0. ADR-027 deferred the poller on 2026-11-10: the channel page's feed address answered 404, and the YouTube Data API needs a key the owner had not created.

What was found on 2026-11-11:

- `https://www.youtube.com/feeds/videos.xml?channel_id=UCTeLqJq1mXUX5WWoNXLmOIA` (Star Citizen) answers 200 with an Atom feed of the channel's fifteen newest uploads, to the project's User-Agent, without a key. Squadron 42 has its own channel, `UCU-xYE7KrmqarZ3Lqu2PK_w` (`@Squadron42`), whose feed answers the same way and lists two uploads. Each entry carries the video's id, its title, its page (`/watch?v=` for a video, `/shorts/` for a Short), its time, a thumbnail on `i.ytimg.com` and the description. One request to each feed and one to the `@Squadron42` page (for the channel's id) were made, inside the hour's allowance; both feeds are kept as test samples.
- CLAUDE.md section 9 limits YouTube RSS to one request an hour. The News workflow runs at 7 and 37 minutes past each hour (PR 66).
- The front page on a phone was one long column: three tall dispatch cards, five full-width ship cards, three to five developer posts that each unfold the whole post, then the funding card. ADR-046 already moved the contents list off phones for the same reason.
- CLAUDE.md section 2 keeps large assets off the app server; every CIG picture the site copies is under an approval box in `docs/legal/cig-approval.md`. `docs/legal/obligations.md` allows no third-party trackers and wants every content item to link its original.

## Decision

**The videos are content items.** `workers/poll-news` gains a `video` source (`sources/video.ts`): both channels' feeds, parsed with the same halt-on-unknown-shape rule as every source (CLAUDE.md section 5), each upload recorded as a content item of source `video` with YouTube's id for it as `external_id`, its page as `url`, its title, the description's first paragraph as `summary`, the description as escaped paragraphs in `body_html`, and the channel's name in `forum`. `forum` already names where on its source an item was published (a Spectrum post's forum); a video's channel is the same fact, so no schema field, no migration and no change to the database's columns is needed, and the field's comment and `docs/data-model.md` now say so. The feeds' view counts and ratings are not kept: they change every hour and would revise every video.

**Once an hour, in total.** CLAUDE.md section 9 allows YouTube RSS one request an hour, so one run reads one feed: the hour's channel (`channelForHour`, by the UTC hour's parity), each channel every two hours. The workflow's two runs an hour become two schedules (`7 * * * *` and `37 * * * *` instead of `7,37`), and the poll step passes `NEWS_VIDEO_SLOT=due` from the `:07` one only (`github.event.schedule`), so a run GitHub starts late still knows which schedule it is, and a `workflow_dispatch` or a run by hand reads no feed unless asked for with `--source video`. YouTube's host is never retried (`NO_RETRY_HOSTS`): a 429 or a 5xx is that hour's answer. A feed is read and parsed in full before anything of it is recorded, so a feed of an unknown shape (no entries, another channel, an entry without its id, a link that is not its watch or Shorts page) leaves the pack as it was (CLAUDE.md section 5); and a failed video read is logged and does not discard the run's Comm-Links and roadmap, which would otherwise wait for the next run because of a channel's feed. The one case this does not hold: a `:07` run GitHub starts more than an hour late could read the same channel as the next hour's run inside one hour; GitHub's scheduled runs are minutes late (ADR-027), not hours.

**The news page's third tab.** `/news/videos`, after Dispatches and Developer posts: the masthead, a chip per channel (`?channel=`), the videos newest first as `VideoCard`s in a grid of one to four columns, twenty-four a page with Newer and Older, the credit under them. The tabs now draw with the Spectrum module off too, without the Developer posts tab. Videos are never dispatches: `Repository.dispatches` leaves them out (and so do the RSS and JSON feeds, which syndicate the dispatches), `?source=video` on the dispatches page is ignored, and `Repository.videos` carries them.

**The front page's "Latest videos".** After "Dispatches from the Verse": the seven newest uploads of both channels as a row that scrolls sideways (`Rail`), "All videos" linking the tab, the credit under the row. The section is not drawn when the pack holds no video.

**The player.** A `VideoCard`'s thumbnail and title are links to the video on YouTube; on a page with the player (`VideoPlayer`, the front page and the tab), a plain press opens it in place instead: a native modal `dialog` over the page dimmed with the page's own colour (`bg-page/80`, as the command palette does), the video's title and a "Close" button above YouTube's privacy-enhanced embed (`youtube-nocookie.com`) at 16:9 within 80% of the small viewport's height, upright for a Short, and "Watch on YouTube" under it. The embed is created on the press and removed on close, so nothing of YouTube's player loads until a reader asks for it and playback stops when they leave. It starts playing on that press. Spec 03 says "never embed autoplay"; the owner's direction to open a video "onsite in like a popout shadow box" amends it, and the criterion now says so: nothing is embedded or plays on arrival, and a press is a request to watch. Escape, the button and a press on the dimmed page close it, and focus returns to the card. Without script, with a modifier key or with a middle click the links go to YouTube. "Watch on YouTube" on every card always goes there (the source link, obligations.md).

**The thumbnails are YouTube's, from YouTube.** A card shows `i.ytimg.com/vi/<id>/mqdefault.jpg` (320 by 180), with `hqdefault.jpg` (480 by 360, whose bands the 16:9 frame crops away exactly) in its `srcset`; both exist for every upload, the larger sizes do not. Nothing is copied: they are not the site's copies of CIG's pictures (the approval boxes govern those) but YouTube's own thumbnails shown beside links to YouTube, as every page that links a video does, and they are sent no referrer. YouTube is the one third party a page loads; `docs/legal/obligations.md` records it beside "no third-party trackers", and the privacy page says what loads from YouTube and when, the player's cookies and storage and any advertising YouTube shows in it included. A title's emoji (some of CIG's carry them) are left out where the page draws it (`withoutEmoji`, CLAUDE.md section 2); the pack keeps the title as it came. The credit under the videos is "Videos: Cloud Imperium Games, on YouTube" (`VIDEO_CREDIT`, `docs/legal/attribution.md`).

**Rows on the front page.** `Rail` (`packages/ui`) is a list that scrolls sideways with scroll snapping, each card a fraction of the row (`basis-4/5` on a phone, so the next card's edge always shows; two and a peek on a tablet; four or five videos, three posts on a desktop), bleeding to the screen's edges on a phone. From tablet width two round buttons page it by its own width, a jump rather than a glide (CLAUDE.md section 7: motion for viewer transitions only), marked unavailable at either end (`aria-disabled`, so focus stays put) and hidden when it fits; they are arrows alone, named for assistive tech, which ADR-044 now lists with the play mark and the player's close cross. The row is a list named for its section, not a landmark of its own. Keyboard readers move through the cards' links, which scroll the row as they take focus. On the front page:

| Section | Phone | From tablet (`md`) |
| --- | --- | --- |
| Dispatches from the Verse | a row of the three cards | three across, as before |
| Latest videos | a row of seven | a row of seven, paged by the buttons |
| Featured vehicles and ships | a row of the five, one shape (4:3) | the bento, as before |
| Featured developer posts | a row of small cards | a row of small cards, three across |
| Funding this year | as before | as before |

The developer posts' row uses `DevPostCard`: `DevPost`'s marks (Spectrum's yellow rule, the role tag's ring) with the time, the thread's title (linked to the post on Spectrum), the author, four lines of the post and the post and thread links; it does not unfold, since a whole post across a card a third of the page wide reads badly, and the whole post is one link away on Spectrum and on the developer posts page, where `DevPost` still unfolds it. On a 390 by 844 phone with Spectrum on, the front page measured 6,399 px tall on the live site on 2026-11-11 and 3,822 px with this change, the new videos section included: the dispatches went from 1,277 px to 466, the featured ships from 1,295 to 328 and the developer posts from 1,497 to 303.

New tokens: none. The widths are fractions of the row, the gaps and sizes from the spacing scale; the play mark and the close cross join the icon set.

## Alternatives considered

| Option | Why not |
| --- | --- |
| The YouTube Data API | Needs a key and a quota; the feed carries everything the cards show without either |
| A schema field `channel` on `ContentItem` | A migration (CLAUDE.md section 6: one per PR, forward-only) and a column for what `forum` already means; reconsider if a third kind of venue appears |
| Videos among the dispatches | The owner asked for their own tab; their cards and thumbnails differ from a dispatch's, and the dispatches' grid would be shared with fifteen uploads a channel |
| Copy the thumbnails into the media store, as the Comm-Link covers are | A copy of CIG's pictures would need an approval box ticked; YouTube's own thumbnails beside a link to YouTube are what YouTube serves for linking, and hotlinking keeps the site from holding them |
| Load the embed on arrival, or keep one player in the page | Loads YouTube's player (and its requests) for every visitor; spec 03 forbids embedding autoplay; the player on a press costs nothing until asked for |
| A third-party lightbox or carousel library | A native `dialog` and CSS scroll snapping do both with no dependency, keyboard and focus included |
| Rows at every width for every section | The desktop's grid and bento already fit the screen; a row there would hide what is visible today. The phone is where the column was too long |
| Hide the rows' scrollbar | It is the one cue on a desktop with no touch that the row continues; it is drawn thin |
| Both feeds every hour | Two requests an hour against section 9's one |
| A file of last-read times beside the pack, to gate the reads | It changes every hour, so every hour would be a data commit and a production deploy (ADR-033) with nothing new to show |

## Consequences

- Spec 03's "Video poller" criterion is ticked, with the reading of "never embed autoplay" above.
- The News workflow reads one feed an hour, the channels in turn; a new upload reaches the pack within two hours and the site at the next deploy of that data commit (ADR-033). The workflow's commit step already adds `fixtures/news`.
- Of the seventeen uploads on record on 2026-11-11, thirteen are Shorts, so the front page's row is mostly Shorts for now; a Short's thumbnail is cropped to the row's 16:9 and labelled. Leaving Shorts off the front page is a one-line change if the owner prefers it.
- A video CIG deletes or makes private stays in the pack (append-only) and its card stays until it is taken down; its thumbnail and player then show YouTube's own notice.
- The first videos were recorded from the two committed samples, not by a third request inside the hour.
- The front page's and the tab's records (`e2e/screens.spec.ts`) change; `e2e/videos.spec.ts` covers the tab, the chips, the player (open, focus, Escape, unload), the dispatches leaving videos out, the front page's row of five to seven, and the phone's rows with no sideways page scroll. `legal.spec.ts` checks the footer on `/news/videos`. The gallery gains `dev-post-card`, `video-card`, `rail` and `rail-phone`, and the icon story the two new glyphs.
- The videos' thumbnails are fetched from YouTube by readers' browsers, as the privacy page now says; Lighthouse may see them as third-party requests on the front page.
- Implemented by the PR that adds this file.
