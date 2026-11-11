# ADR-041: The site is Coppercork: the name, the mark and the tagline

- Status: accepted; the mark is replaced by the owner's "Launch Cork" logo (ADR-045), the name and the tagline stand
- Date: 2026-11-10
- Deciders: owner ("we need a logo for the site and Let's call it Coppercork and for the tagline should cleverly and cleanly outline what it is", 2026-11-10), Claude Code session 2026-11-10
- Resolves: CLAUDE.md section 12, "Project name" (the one open decision this record closes; the licence, the hero ship list and the Spectrum access method stay open)
- Amends: ADR-036 (the User-Agent's product token), ADR-005 and ADR-021 (the shell's brand), ADR-020 (which rejected brand colours as an alternative; this record allows one, for the mark alone), spec 05's "Name and domain" criterion, system.md's colour table

## Context

"SC Hub" was the working title since the handoff kit (CLAUDE.md section 12), written once in `packages/schema/site.ts` so the pages and every fetcher's User-Agent carried the same name (ADR-036). The site has been live at coppercork.com since 2026-11-10 (ADR-033), under the owner's domain, with a placeholder favicon (a plain accent square) and no mark. The owner named the site Coppercork, asked for a logo, and for a tagline that says what the site is, cleverly and cleanly.

The design rules bound the mark: no sci-fi display face, no glow, bevel or neon (CLAUDE.md section 2); one accent colour in the interface (section 7); the chrome stays quiet and the imagery carries the mood (system.md). A logo is not interface chrome, and a brand usually has a colour of its own; the manufacturer pages already allow a brand colour as one narrow rule.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The name | `SITE_NAME` is "Coppercork", in `packages/schema/site.ts` as before. The User-Agent's product token becomes `Coppercork/1.0` (no space to replace); page titles read "<entity> — Coppercork"; the RSS and JSON feeds are "Coppercork news"; the storage keys of the compare set and the palette's recent entries derive from the name and so change, which resets them once for every reader | One place, as ADR-036 set it; the keys were never promised to survive a rename |
| The mark | A cork stopper seen from the side, in copper, with a thin ink band for its label: `Logo` in `packages/ui/components/logo.tsx`, 28 px beside the wordmark in the header, decorative (`aria-hidden`, the name is the link's text); `apps/web/app/icon.svg` is the same drawing on a transparent ground for the favicon. The owner was shown three (the stopper, a copper ring, two nested Cs) and the stopper is what ships unless he says otherwise | It is the name's object, reads at 16 px as a rounded block with a line, and keeps the chrome quiet |
| The brand colour | One, copper, used only in the mark and the favicon: the token `brand.copper`, `#A8652F` on the light wall and `#D08A4F` on the dark, in `packages/ui/tokens.ts` and system.md's colour table like every colour, so the token tests guard it and section 7's "tokens live in tokens.ts and nowhere else" stays true. The mark reads `--brand-copper`; a unit test keeps the favicon's drawing and fill equal to the mark's and the token's, and finds the token read nowhere else. Never a text, border or fill colour anywhere else; the accent stays periwinkle (ADR-032). The favicon is static, in the light value on a transparent ground, so it does not follow the scheme | The allowance CLAUDE.md section 2 asks an ADR for; a mark without its colour would be a glyph |
| The wordmark | The name set in the header's existing style, Manrope medium at `ui` size; no lettering of its own | One face (ADR-021) |
| The tagline | `SITE_TAGLINE`: "Star Citizen, on record: every ship and part, the dispatches, what the developers say and how the funding grows, kept current." It is the metadata description of the home and every page without one of its own, and the about page's first line follows it. The owner was shown three; this one ships unless he picks another | Says what the site is in one sentence, in the site's own words ("on record", the sections' names) |
| What does not change | The disclaimer and trademark lines (`packages/ui/legal.ts`), which never carried the name; the contact address; the domain; the Open Graph image's layout (it prints `SITE_NAME`); the fankit badge. The identifiers that carry the working title stay as they are, since they are keys, not names: the news pack's UUID namespace `sc-hub:news:` (every content item's stable id derives from it), the custom-event names `sc-hub:theme` and `sc-hub:build`, the environment variable `SC_HUB_CONTACT_EMAIL`, the monorepo's package name, the news workflow's git author and the Vercel project and store names | A key renamed is a record re-identified |

## Alternatives considered

| Option | Why not |
| --- | --- |
| A mark in the accent or in ink only | Legible, but the name is a colour; copper in the mark alone keeps the one-accent rule for the interface |
| A display face or lettering for the wordmark | CLAUDE.md section 2 and ADR-021: one face |
| Keep the old storage keys by hard-coding "sc-hub" | A reader's compare set is a convenience, not a record; one reset is cheaper than a constant that lies about the name |
| Telling CIG the name now | Spec 05's criterion keeps "CIG has seen the name" as its own box; the approval record is the owner's to send |

## Consequences

- `packages/schema/site.ts`, its test, `packages/ui/brand.ts`, `packages/ui/tokens.ts` (`brand.copper`) and the generated `tokens.css`, `packages/ui/components/page-shell.tsx` (the mark beside the name), `packages/ui/components/logo.tsx` (new, with a story and a test), `apps/web/app/icon.svg`, the feed routes, `apps/web/e2e/seo.spec.ts`.
- Deferred from the audit: the about page's copy says "a record of Star Citizen", not "is Star Citizen", two lines under the non-affiliation statement; the tagline keeps "Star Citizen, on record" as a fragment. A reader's old `sc-hub.compare` and `sc-hub.recent` storage entries are left where they are, never read again.
- CLAUDE.md sections 1 and 12, `README.md`, `package.json`, `packages/ui/README.md`, system.md section 2 (the brand colour's note), spec 05's criterion say the name.
- Every page's header changes, so every record changes; the committed records are regenerated from a build with the CDN's pictures.
- The front page's title line is the next change (ADR-042, the daily line); the tagline does not replace it.
