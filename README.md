# Coppercork — Claude Code handoff kit

This folder is the starting state of the repo. Copy its contents into a fresh git repository and open Claude Code there. Everything Claude Code needs to begin Phase 0 is in these files; nothing else has to be explained in chat.

The site is **Coppercork** (ADR-041; "SC Hub" was the working title). The license is still an open decision (see `CLAUDE.md` → Open decisions).

## Order of operations

1. Create an empty private GitHub repo. Clone it. Copy this kit's contents into the root (including the hidden `.github/` folder).
2. Replace the placeholders in `docs/legal/cig-approval.md` with what CIG actually agreed to in writing. If something is not yet in writing, leave the checkbox unticked — the specs read those checkboxes.
3. Create the accounts Claude Code cannot create for you and put the tokens in a local `.env` (never committed): Vercel, Neon, Cloudflare (R2 + domain), Fly.io, Sentry, GitHub. The variable names are listed in `CLAUDE.md` → Environments.
4. Open Claude Code in the repo root and paste **Prompt 1** from `KICKOFF.md`. That starts Phase 0.
5. On the Windows machine with Star Citizen installed, open Claude Code in the same repo and paste **Prompt W1** when Phase 1 begins.
6. After each phase, run the **Audit prompt** in a fresh session before merging.

## What is where

| Path | Purpose |
| --- | --- |
| `CLAUDE.md` | The constitution: rules, contracts, conventions, definition of done. Claude Code reads it every session. |
| `KICKOFF.md` | The exact prompts to paste: Phase 0 start, Windows pipeline start, audit, and patch day. |
| `docs/scope.md` | Condensed scope. The full plan lives in the Claude doc linked at the top of that file. |
| `docs/specs/*.md` | One spec per phase. Acceptance criteria are checkboxes; a phase is done when all are ticked. |
| `docs/design/system.md` | Design principles, tokens, type scale, component rules, page templates. |
| `docs/data-model.md` | Entities, keys, versioning rules. The source for `packages/schema`. |
| `docs/legal/*` | CIG approval record, standing obligations, takedown procedure, attribution lines. |
| `docs/decisions/*` | Architecture decision records. ADR-001 (stack) and ADR-002 (data contracts) are pre-written. |
| `docs/runbooks/patch-day.md` | The one-command procedure for a new game build. Phase 1 fills in the command. |
| `.github/PULL_REQUEST_TEMPLATE.md` | The checklist every PR must satisfy. |
