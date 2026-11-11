# Runbook: the pictures and models on the live site

How the media reach the CDN and the site, and what to do after a refresh. The decision is ADR-034; nothing is published until the four imagery boxes in `docs/legal/cig-approval.md` are ticked on the owner's word or CIG's.

## What exists

| Thing | Value |
| --- | --- |
| Store | Vercel Blob `sc-hub-media` (public), connected to the `sc-hub` project; keys under `media/` |
| Public address | `CDN_BASE_URL` = `https://eieovaxp8q6yustn.public.blob.vercel-storage.com` (the store's id, lower-cased, without `store_`); set on Vercel for production and preview; not a secret |
| Credentials | In `.env.local` at the root of the checkout that holds the complete media, written by `vercel env pull .env.local`: `BLOB_STORE_ID` and a `VERCEL_OIDC_TOKEN` good for about twelve hours (the store's read-write token is sensitive on the project and is not pulled). The connection must include the Development environment for the OIDC pair to work (Storage → the store → Projects → `sc-hub` → environments). Never on Vercel's side for the site, never in CI |
| Keys | Content-addressed: `media/ships/aegs_gladius-1280-<hash12>.webp`, cached for a year. The one mutable object is `media/manifest.json`, cached five minutes |

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

A schema change that adds a field to `MediaManifest` merges to `main` before the media built with it are published: the build validates the fetched manifest against the schema it has, and `main` fails to build on a manifest it does not know.

## Checks after a deploy

1. The Vercel build log shows `"job":"media:manifest","source":"cdn"` with the new `generated_at`.
2. `https://coppercork.com/ships/gladius` draws the opening picture from `CDN_BASE_URL` (view the image's address), and the model in Scale loads; the browser console shows no CORS error.
3. `curl -sI "$CDN_BASE_URL/media/manifest.json"` answers 200 with a `cache-control` of five minutes; a rendition answers with a year.

## Taking a picture down

Remove it from the fixtures or its sources file, rebuild and publish, redeploy, then `publish.ts --prune` deletes the old key from the store. Browsers that cached the old key keep it for up to a year; the site stops naming it at the redeploy.
