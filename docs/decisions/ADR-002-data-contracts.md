# ADR-002: Data contracts

- Status: accepted
- Date: 2026-11-06
- Deciders: owner, scoping session

## Context

Star Citizen patches frequently on two channels, renames ships, changes record shapes without notice, and the site's credibility rests on stats being right for the version the reader is looking at. Most fan tools rot because a patch breaks a parser and nobody notices until readers do. The contracts below are chosen to make breakage loud and versions auditable.

## Decision

1. **Identity is `class_name`.** Display names, slugs, manufacturers are attributes. Slugs are computed once and kept in `slug_history` on rename.
2. **Every stat row carries `channel` and `game_version`.** No unversioned stats exist anywhere in the schema.
3. **LIVE is canonical.** PTU is displayed as a diff against LIVE; the default view is always LIVE.
4. **Published versions are immutable.** Fixes produce a new version. The import job flips `is_current` in one transaction.
5. **Imports halt on unknown shapes.** Schema validation failure stops the run and writes a report; nothing partial goes live.
6. **Raw remainder is kept.** Every stats table has a `raw` JSONB column for unmapped fields.
7. **Content is append-only with revisions.** Source edits create a revision; the newest displays.
8. **Entity links carry confidence** and display at ≥ 0.9 or when manually confirmed. Ambiguity lives in one exclusion file, not in code paths.
9. **Takedown is a flag, not a delete.** Items return 410 and are purged from search and CDN by the next job.
10. **The pipeline↔web contract is `packages/schema`.** The pipeline validates its output against it before publishing; the import job validates again before writing.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Display names as identity | CIG renames ships (and manufacturers rebrand); links would break |
| Mutable "current" stats table with history elsewhere | Makes "what did this say on 4.2" unanswerable and makes a bad import irreversible |
| Best-effort imports that skip bad records | Silent gaps are how fan sites lose trust; a halted run is visible and fixable in a weekend |
| Hard-delete on takedown | Loses the audit trail and makes accidental re-import possible on the next poll |

## Consequences

- Storage grows per version. At current entity counts this is megabytes, not gigabytes; a retention policy can prune raw JSONB for versions older than a year if it ever matters.
- Every page that shows a stat must know which version it is showing and say so (the patch strip and the per-page version label).
- Normalizer changes need fixtures from the version that broke, which is why Phase 1 captures fixtures per version from day one.
