# Runbook: the pictures and models on the live site

How the media reach the CDN and the site, and what to do after a refresh. The decision is ADR-034; nothing is published until the four imagery boxes in `docs/legal/cig-approval.md` are ticked on the owner's word or CIG's.

## What exists

| Thing | Value |
| --- | --- |
| Store | Vercel Blob `sc-hub-media` (public), connected to the `sc-hub` project; keys under `media/` |
| Public address | `CDN_BASE_URL` = `https://eieovaxp8q6yustn.public.blob.vercel-storage.com` (the store's id, lower-cased, without `store_`); set on Vercel for production and preview; not a secret |
| Credentials | In `.env.local` at the root of the checkout that holds the complete media, written by `vercel env pull .env.local`: `BLOB_STORE_ID`, a `VERCEL_OIDC_TOKEN` good for about twelve hours and, since the connection includes Development, the read-write token too, because the owner made the store's variables non-sensitive on 2026-11-10 ("Yes, make readable", in the session that built ADR-034); the script prefers the token and falls back to the OIDC pair. The store's connection to the project must include the Development environment or the pull yields a token the store refuses ("OIDC is enabled for this project, but not for the development environment"); it was added on 2026-11-10 (Storage → the store → Projects → `sc-hub` → environments). `.env.local` is git-ignored; never on Vercel's side for the site, never in CI |
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

## Checks after a deploy

1. The Vercel build log shows `"job":"media:manifest","source":"cdn"` with the new `generated_at`.
2. `https://coppercork.com/ships/gladius` draws the opening picture from `CDN_BASE_URL` (view the image's address), and the model in Scale loads; the browser console shows no CORS error.
3. `curl -sI "$CDN_BASE_URL/media/manifest.json"` answers 200 with a `cache-control` of five minutes; a rendition answers with a year.

## Taking a picture down

Remove it from the fixtures or its sources file, rebuild and publish, redeploy, then `publish.ts --prune` deletes the old key from the store. Browsers that cached the old key keep it for up to a year; the site stops naming it at the redeploy.
