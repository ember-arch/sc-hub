# Runbook: the pictures and models on the live site

How the media reach the CDN and the site, and what to do after a refresh. The decision is ADR-034; nothing is published until the four imagery boxes in `docs/legal/cig-approval.md` are ticked on the owner's word or CIG's.

## What exists

| Thing | Value |
| --- | --- |
| Bucket | Cloudflare R2, `R2_BUCKET` in the owner's `.env.local`; keys under `media/` |
| Public address | `CDN_BASE_URL`, the bucket's custom domain or its `r2.dev` address; set on Vercel for production and preview; not a secret |
| Credentials | An R2 API token (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) in `.env.local` at the root of the checkout that holds the complete media; nowhere else, never on Vercel, never in CI |
| Keys | Content-addressed: `media/ships/aegs_gladius-1280-<hash12>.webp`, `Cache-Control: public, max-age=31536000, immutable`. The one mutable object is `media/manifest.json`, `max-age=300` |
| CORS | `GET`, `HEAD` from any origin, set by the publish script (needs a token with bucket configuration rights) or pasted into the bucket's Settings → CORS policy |

## After a media refresh

From the checkout whose `fixtures/` hold the complete copies (RSI images and covers, galleries, holoviewer models, title icons, the fankit):

```
pnpm --filter schema build
pnpm exec tsx scripts/media/prepare.ts
pnpm exec tsx scripts/media/publish.ts
```

The publish prints one summary line: how many objects the plan has, how many were already in the bucket, how many went up, whether the manifest changed, how many old keys are now orphans, and what the CDN answered when the manifest was read back (`"manifest": "current"`) and one picture was asked for with an `Origin` (`"cors": "*"`). Try `--dry-run` first to see the plan without uploading; `--prune` deletes the orphans, and only on a run whose manifest did not change: after a publish, redeploy first, then run `publish.ts --prune`, because the live site names the old keys until its build fetches the new manifest. The script refuses to prune in the run that changed the manifest. Keep each run's summary line; the first one is the evidence for spec 00's infrastructure criterion.

Then redeploy the site: a push to `main` does it, or Deployments → Redeploy in the Vercel dashboard. The build fetches `manifest.json` from the CDN; until that build, the live site keeps the manifest it was built with. If the publish's CDN check said `previous`, the edge still holds the older manifest for up to five minutes: wait that long before the redeploy.

## Checks after a deploy

1. The Vercel build log shows `"job":"media:manifest","source":"cdn"` with the new `generated_at`.
2. `https://coppercork.com/ships/gladius` draws the opening picture from `CDN_BASE_URL` (view the image's address), and the model in Scale loads; the browser console shows no CORS error.
3. `curl -sI "$CDN_BASE_URL/media/manifest.json"` answers 200 with `cache-control: public, max-age=300, must-revalidate`; a rendition answers with `max-age=31536000, immutable`.

## Moving the CDN address

The manifest keeps relative `/media/` paths, so moving from the `r2.dev` address to `media.coppercork.com` (or back) is: connect the domain to the bucket in Cloudflare, change `CDN_BASE_URL` on Vercel, redeploy. No re-upload.

## Taking a picture down

Remove it from the fixtures or its sources file, rebuild and publish, redeploy, then `publish.ts --prune` deletes the old key from the bucket. Browsers that cached the old key keep it for up to a year; the site stops naming it at the redeploy.
