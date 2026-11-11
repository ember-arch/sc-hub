# Runbook: the pictures and models on the live site

How the media reach the CDN and the site, and what to do after a refresh. The decision is ADR-034; nothing is published until the four imagery boxes in `docs/legal/cig-approval.md` are ticked on the owner's word or CIG's.

## What exists

| Thing | Value |
| --- | --- |
| Store | Vercel Blob `sc-hub-media` (public), connected to the `sc-hub` project; keys under `media/` |
| Public address | `CDN_BASE_URL` = `https://eieovaxp8q6yustn.public.blob.vercel-storage.com` (the store's id, lower-cased, without `store_`); set on Vercel for production and preview; not a secret |
| Credentials | In `.env.local` at the root of the checkout that holds the complete media, written by `vercel env pull .env.local`: `BLOB_STORE_ID`, a `VERCEL_OIDC_TOKEN` good for about twelve hours and, since the connection includes Development, the read-write token too, because the owner made the store's variables non-sensitive on 2026-11-10 ("Yes, make readable", in the session that built ADR-034); the script prefers the token and falls back to the OIDC pair. The store's connection to the project must include the Development environment or the pull yields a token the store refuses ("OIDC is enabled for this project, but not for the development environment"); it was added on 2026-11-10 (Storage → the store → Projects → `sc-hub` → environments). `.env.local` is git-ignored; never on Vercel's side for the site. In CI only the News workflow's cover step has the token, as the repository secret `BLOB_READ_WRITE_TOKEN` (ADR-048) |
| Keys | Content-addressed: `media/ships/aegs_gladius-1280-<hash12>.webp`, cached for a year. The one mutable object is `media/manifest.json`, cached five minutes |

## The order that cannot be reversed

The build from ADR-034 on fetches `manifest.json` from `CDN_BASE_URL` and fails on anything but a 200 (`apps/web/scripts/media-manifest.ts`). So: the first publish runs before the first deploy of that code, and `CDN_BASE_URL` is set on Vercel only once `manifest.json` answers 200 (`curl -sI "/media/manifest.json"`). The site code before ADR-034 ignores the variable, which is why it could be set on 2026-11-10 while the first publish was still running, ahead of the merge. The same holds for a new store: publish, then point `CDN_BASE_URL` at it, then redeploy.

## After a media refresh

From the checkout whose `fixtures/` hold the complete copies (RSI images and covers, galleries, holoviewer models, title icons, the fankit):

```
vercel env pull .env.local
pnpm --filter schema build
pnpm exec tsx scripts/media/prepare.ts
pnpm exec tsx scripts/media/publish.ts
```

The publish prints one summary line: how many objects the plan has, how many were already in the store, how many went up, whether the manifest changed, how many old keys are now orphans, and what the CDN answered when the manifest was read back (`"manifest": "current"`) and one picture was asked for with an `Origin`. Try `--dry-run` first to see the plan without uploading; `--prune` deletes the orphans, and only on a run whose manifest did not change: after a publish, redeploy first, then run `publish.ts --prune`, because the live site names the old keys until its build fetches the new manifest. The script refuses to prune in the run that changed the manifest. Keep each run's summary line; the first one is the evidence for spec 00's infrastructure criterion.

Then redeploy the site: a push to `main` does it, or Deployments → Redeploy in the Vercel dashboard. The build fetches `manifest.json` from the CDN; until that build, the live site keeps the manifest it was built with. If the publish's CDN check said `previous`, the edge still holds the older manifest for up to five minutes: wait that long before the redeploy.

A new `MediaManifest` field carries a `.default(...)`, as every field added since ADR-009 does: the build validates the fetched manifest against the schema it has (`MediaManifest` is strict), so without a default either order of merging the schema and publishing the media fails a build. With one, merge the schema first, then publish.

An expired `VERCEL_OIDC_TOKEN` (about twelve hours after `vercel env pull`) shows as "Access denied, please provide a valid token": pull again and rerun; the run resumes by key.

## Publish log

| Date | Run | Result |
| --- | --- | --- |
| 2026-11-10 | first publish, from the complete media built on 2026-11-10T05:43:49Z plus the Comm-Link covers | 12,861 objects, 1,726,316,255 bytes, all uploaded, manifest uploaded and read back `current` (max-age 300), sample rendition 200 `image/webp` with a year's cache and CORS `*`, 0 errors, 273 s. The evidence for the object-store part of spec 00's infrastructure criterion |
| 2026-11-11 | second publish, from the ADR-034 session's own `prepare.ts` build on `main` (`C:Users	rlivsc-hub-cdn`), overlapping the first | 12,309 objects named, 11,029 already in the store from the first run, 1,280 uploaded (405 MB), manifest `generated_at` 2026-11-11T00:13:23.580Z with the 109 Comm-Link covers of the news window; it overwrote the first manifest at the origin and is the one the site builds from. Both manifests' objects stay in the store until a `--prune` run; two publishes should not overlap again, one writer at a time |

## New Comm-Link covers, from CI (ADR-048)

The News workflow's step "Publish new Comm-Link covers" puts each new Comm-Link's cover on the site by itself: every run it reads the live manifest from the store, looks on RSI's hub for the Comm-Links of the last fortnight that have no cover, uploads their web copies, adds them to the manifest (nothing else in it changes, and the write is refused if the manifest changed since it was read), and adds a row per cover to `fixtures/rsi-media/cover-sources.json`. That row's commit to main redeploys the site on the new manifest. The step's log ends with one summary line: the candidates, what was planned and uploaded, `manifest` (`uploaded`, `nothing to do`, `dry run`), each list's count before and after, and whether the CDN served the new manifest.

| Thing | Value |
| --- | --- |
| Secret | `BLOB_READ_WRITE_TOKEN` in the repository's Actions secrets (Settings → Secrets and variables → Actions), the store's read-write token from the Vercel dashboard (Storage → `sc-hub-media` → the token). Until it exists the step is a dry run that writes nothing |
| Rehearsal | Actions → News → Run workflow, with Comm-Link ids whose covers are already up in "rehearse_covers" (for example `20943`): a dry run as if they had none; the summary's `rehearsal` says whether the keys it planned are the live ones |
| Locally | `pnpm exec tsx scripts/media/publish-covers.ts --dry-run` (`--rehearse <ids>`, `--pages <n>`, `--recent-days <n>`) with `CDN_BASE_URL` and `SC_HUB_CONTACT_EMAIL` set |

What it means for the hand publish: CI's covers are in the store and the record but not in a checkout's `fixtures/rsi-media/covers/`. So before `prepare.ts`, pull main and run `pnpm exec tsx scripts/media/fetch-covers.ts`, which copies every recorded cover whose file is missing. `publish.ts` refuses a manifest that lacks a cover the live one has and names them; `--allow-cover-drop` lets it go ahead when they are meant to go (a takedown). It also refuses, without overwriting anything, when the live manifest changed while it ran: fetch, prepare and publish again.

## Checks after a deploy

1. The Vercel build log shows `"job":"media:manifest","source":"cdn"` with the new `generated_at`.
2. `https://coppercork.com/ships/gladius` draws the opening picture from `CDN_BASE_URL` (view the image's address), and the model in Scale loads; the browser console shows no CORS error.
3. `curl -sI "$CDN_BASE_URL/media/manifest.json"` answers 200 with a `cache-control` of five minutes; a rendition answers with a year.

## Taking a picture down

Remove it from the fixtures or its sources file, rebuild and publish, redeploy, then `publish.ts --prune` deletes the old key from the store. Browsers that cached the old key keep it for up to a year; the site stops naming it at the redeploy.
