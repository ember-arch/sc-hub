# Kickoff prompts

Paste these into Claude Code verbatim. Each one assumes the repo root is the working directory and `CLAUDE.md` is present.

---

## Prompt 1 — Phase 0 start (laptop or cloud session)

```
Read CLAUDE.md in full, then docs/specs/00-foundation.md, docs/design/system.md, docs/data-model.md, and docs/decisions/ADR-001-stack.md.

Enter plan mode. Produce a plan for the first three acceptance criteria of Phase 0 only: the monorepo scaffold, packages/schema with the initial Zod types from docs/data-model.md, and the CI workflow. For each, list the files you will create, the commands you will run, and how you will verify it. Do not write code until I approve the plan.

Constraints to confirm you have read: no colors or type sizes outside packages/ui tokens; every script name in CLAUDE.md section 6 exists after scaffold even if stubbed; fixtures only, no network in tests.
```

---

## Prompt 2 — continuing a phase (any session)

```
Read CLAUDE.md and docs/specs/<NN>-<phase>.md. The next unticked acceptance criteria are: <paste one to three>.

Enter plan mode and propose how you will complete them, including tests and the verification steps from CLAUDE.md section 8. Wait for approval. After approval, build on a branch named spec/<NN>-<phase>/<short-name>, commit per criterion, open a PR with the template, tick the criteria in the spec in the same PR, and stop with the preview URL.
```

---

## Prompt W1 — Phase 1 start (Windows PC with Star Citizen installed)

```
Read CLAUDE.md in full, then docs/specs/01-data-spine.md, docs/data-model.md, and docs/runbooks/patch-day.md.

This machine has Star Citizen LIVE and PTU installed under SC_INSTALL_ROOT and StarBreaker at STARBREAKER_BIN. Confirm both paths exist before anything else and report the detected build versions for each channel.

Enter plan mode for the first two acceptance criteria of Phase 1: version detection and a raw DataCore extract for vehicles, items, loadouts, and localization into pipeline/out/<channel>/<version>/raw/. Report the record counts and the output size. Do not normalize yet. Do not upload anything.

Capture a fixture set: for five ships of different sizes and manufacturers, copy their raw records plus every item referenced by their default loadout into fixtures/<version>/. Keep the fixture set under 5 MB; strip binary blobs.
```

---

## Prompt W2 — hero model export (Windows PC, Phase 4)

```
Read CLAUDE.md, docs/specs/04-viewer.md, and pipeline/hero-ships.json.

For the first hero ship only, run the StarBreaker entity export to GLB with textures, then the gltf-transform pipeline defined in the spec, producing preview and full tiers. Report the size of each tier, triangle count, texture count and resolution, and the time taken. Do not upload. Stop and show me the numbers before processing the rest of the list.
```

---

## Audit prompt — run in a fresh session before merging any phase PR

```
You are auditing a pull request you did not write. Read CLAUDE.md in full and docs/specs/<NN>-<phase>.md, then read the diff of PR #<n> (git diff main...<branch>).

Report, in this order:
1. Hard-rule violations from CLAUDE.md section 2 (quote the rule and the file:line).
2. Acceptance criteria ticked in the spec that the diff does not actually satisfy, with the evidence missing.
3. Data-contract violations from CLAUDE.md section 5.
4. Design-rule violations from CLAUDE.md section 7, with a screenshot reference if one exists in the PR.
5. Tests that are missing, trivially passing, or hitting the network.
6. Anything that would break on the next game patch.
7. What you would merge as-is, what must change, and what can be deferred with a note.

Be specific and short. Do not fix anything; report only.
```

---

## Patch-day prompt (Windows PC, after Phase 1)

```
A new Star Citizen build is out. Read docs/runbooks/patch-day.md and run it for the <LIVE | PTU> channel. Stop and report at the first unknown record shape; do not patch the normalizer without showing me the record. When the run is clean, report the summary line and the diff count against the previous version, then run the publish step and tell me when the import job has flipped the channel pointer.
```

---

## Design review prompt (laptop, end of Phase 0 and at any design PR)

```
Read docs/design/system.md. Open the Vercel preview at <url> with Playwright at 390x844 and 1280x800, light and dark. Capture the home page, one ship page, and the news feed. For each screenshot, list every element that breaks a rule in the design system by rule number, and every place the page could lose an element without losing meaning. Propose the cut list. Do not change code.
```
