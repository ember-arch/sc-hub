# ADR-011: Showcase ships read as a dossier, not a hero page

- Status: accepted (owner direction 2026-11-08)
- Date: 2026-11-08
- Deciders: owner, Claude Code session 2026-11-08

## Context

The owner liked the cinematic Odin page (ADR-010) but asked for it to be "more of a dossier type of screen than a marketing/sales hero page".

## Decision

| Concern | Choice |
| --- | --- |
| Header | A file strip (Ship dossier, File `ANVL-ODIN`, Revealed, Compiled or Build, number of sources, status badge), the maker's mark and name, the ship's name at `hero` size, CIG's tagline; then the key art as a framed exhibit (Fig. A, the cut-out layered over the art inside the frame) beside a Particulars sheet (designation, class, size, status and every figure, with its source cited by number) |
| Body | Numbered sections in one run with a sticky contents rail on desktop and a collapsible Contents on phones: Summary (CIG's opening, in their words; the plan view as Fig. 1 for the Odin; the in-game description for live ships), Capabilities (each article chapter as entry 2.1, 2.2… with its render or render loop as a numbered figure), Holoviewer model (framed figure), Schematics, To scale, Exhibits (numbered contact sheet, each opens full size), then for a live ship the game data (ranks, armament, specifications, hardpoints) numbered in the same run, and Sources last as a numbered reference list that captions cite as [1], [2] |
| Everything contained | The dossier sits in the content width: no full-bleed banners, no text over art, no marquee type on ship pages. `Section` gains an optional `number` for the dossier style |
| Home | The dossier index (owner, 2026-11-08: "Yes, home too"): a file strip (Dossier index, files, in concept, updated; the build stays in the footer's patch strip, ADR-007), "Ship dossiers" with search, two featured files (the Odin as concept hero, the Perseus as live example: file number, status, framed art, tagline, three particulars, Open dossier), the register of every file (thumbnail, file number, ship, maker, role, status, length, crew; maker, role and length step aside on phones, the file number moves under the name), then the feed. The full-bleed spotlight and the `marquee` type size are gone |

## Consequences

- `spotlight.tsx`, `showcase-hero`, `showcase-sections`, `chapters` and `figures` are replaced by `showcase/dossier.tsx`, `exhibits.tsx` and `live-dossier.tsx`; `ModelStage` renders as a framed figure.
- The Odin page is about 10,000 px tall at 1280, down from 19,000.
