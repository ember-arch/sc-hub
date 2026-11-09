# fixtures/titles-media

Local copies of the title icons, for development only (ADR-017). **The images are git-ignored and must never be committed or deployed.** Only this README and `sources.json` are in git.

The icons are Cloud Imperium Games' art. The Star Citizen Wiki hosts them and labels its title icons "Cloud Imperium IP": they are not the wiki's own work and are not covered by its CC BY-SA text licence. RSI publishes no list of title icons, so the owner allowed copying them once from the wiki's uploads for local development (2026-11-08). Showing them on the public site is a separate, open decision in `docs/legal/cig-approval.md`.

`sources.json` lists each copied file: the wiki's file name, the original upload address on media.starcitizen.tools, the wiki's description page for the file, its size, its SHA-256 and when it was copied.

Copy or refresh with:

```
pnpm --filter schema build && pnpm exec tsx scripts/titles/fetch-icons.ts
```

One request per icon, at least 5 seconds apart, with the project User-Agent; icons already copied from the same address are skipped. `scripts/media/prepare.ts` builds the web copies in `apps/web/public/media/titles/` (also git-ignored). Without these files the site shows each title without its icon.
