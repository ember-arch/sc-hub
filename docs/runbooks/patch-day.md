# Runbook — patch day

Owner runs this on the Windows PC when a new LIVE or PTU build is installed. Target: one command, under an hour, no Claude Code needed once Phase 1 is done. Until then, use the patch-day prompt in `KICKOFF.md`.

## Before

- [ ] The launcher has finished installing the new build for the channel.
- [ ] `pnpm pipeline:detect` shows the new version string for that channel and "not yet published".
- [ ] At least 60 GB free on the extraction drive.

## Run

```
pnpm pipeline:all --channel LIVE
```

What it does, in order: detect → extract → normalize → fixtures → diff → publish → trigger import. It prints one summary line at the end:

```
run=<id> channel=LIVE version=<v> vehicles=<n> items=<n> ports=<n> diff=<added>/<removed>/<changed> errors=0 duration=<m>m
```

## If it stops

- **Unknown record shape** — the run halts and writes `pipeline/reports/<run_id>.md`. Do not edit the normalizer blind. Open Claude Code, paste the patch-day prompt from `KICKOFF.md`, and let it show you the record before proposing a fix. The fix ships with a new fixture from this version.
- **Publish refused: version exists** — the version was already published. Use `--force` only if you know why.
- **Import failed checksum** — re-run `pnpm pipeline:publish`; if it fails again, the upload is incomplete; check R2 credentials and retry.

## After

- [ ] `pnpm workers:import --status` shows the new version as current for the channel.
- [ ] The patch strip on the live site shows the new version.
- [ ] Open three ship pages you know well and sanity-check the stats against the game.
- [ ] If this is a LIVE build: run `pnpm pipeline:models --hero` to refresh hero models (Phase 4 onward); it only re-exports ships whose geometry hash changed.
- [ ] Review `workers/poll-spectrum/staff.json` for new or departed staff names (Phase 3 onward).

## Rollback

Flip the channel pointer back to the previous version:

```
pnpm workers:import --channel LIVE --set-current <previous version>
```

Published versions are immutable, so the previous one is intact.
