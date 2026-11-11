# ADR-034: The pictures and models reach the live site from Cloudflare R2 behind the CDN

- Status: proposed; becomes accepted on the owner's word recorded under "The owner's decision" below
- Date: 2026-11-10
- Deciders: owner, Claude Code session 2026-11-10

## Context

The site went live at coppercork.com on 2026-11-10 with words and data only (ADR-033). Every CIG picture and model the site can show is local by design: `scripts/media/fetch-*.ts` copy RSI's ship-matrix images and Comm-Link covers, the wiki's gallery pictures, RSI's holoviewer models and the wiki's title icons into git-ignored `fixtures/` folders (ADR-009, ADR-017, ADR-024, ADR-025, ADR-029), and `scripts/media/prepare.ts` builds them into git-ignored `apps/web/public/media/`: WebP renditions at several widths, meshopt glTF models, five render loops, and a `manifest.json` the site reads at build through `apps/web/lib/media.ts`. On the owner's machine that is about 12,000 files and 1.7 GB. A deploy has none of it, so the live site rendered bare, and the owner, having seen it bare, wants the pictures.

The constraints:

- CLAUDE.md section 2: "Never route models, textures, thumbnails, or other large assets through the app server. They are served from object storage behind the CDN." Vercel's static file serving is the app server; 1.7 GB is also far past what a deployment should carry, and the media must never enter git.
- CLAUDE.md section 9 names `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `CDN_BASE_URL`, validated in `packages/schema/env.ts`; spec 01's publish step and ADR-001 always meant Cloudflare R2. None was set anywhere before this ADR.
- The media are CIG's. `docs/legal/cig-approval.md` has the "RSI website images", "Wiki gallery pictures", "RSI holoviewer models" and "Title icons" boxes unticked, with no CIG writing on file; each says "local development only until ticked". The owner's standing direction is to build as if approved (ADR-019), and he ticked the Spectrum republication box on his own word on 2026-11-10. Publishing CIG's pictures to a public address is his explicit call, not a consequence of ADR-019.
- The renditions are not content-addressed. `prepare.ts` names them by entity and width (`/media/ships/aegs_gladius-1280.webp`), and rebuilds the same name with new bytes when RSI changes a picture. A long cache lifetime on those names would show stale pictures for as long as the lifetime.
- The holoviewer loads its models with `fetch` (three.js `GLTFLoader`), which is a cross-origin request once the models live on another host; `<img>` and `<video>` are not.
- coppercork.com's DNS is at the registrar (Squarespace), pointing at Vercel (ADR-033). R2's custom domains, which are what puts a bucket behind Cloudflare's cache, need the domain to be a zone in the same Cloudflare account. R2's `r2.dev` address works without that, but Cloudflare documents it as rate-limited and uncached, for development only.

## Decision

The built media are published to one R2 bucket (`R2_BUCKET`) and served to browsers from its public address (`CDN_BASE_URL`); the site never serves a picture or a model itself.

**Publishing** is `scripts/media/publish.ts`, run by hand on the owner's machine after `prepare.ts`, never from CI: CI has neither the media nor credentials. It reads `R2_*` and `CDN_BASE_URL` from `.env.local` at the repository root and prints no value from them. Every file is **content-addressed**: `/media/ships/aegs_gladius-1280.webp` is uploaded as `media/ships/aegs_gladius-1280-<first twelve hex of its SHA-256>.webp`, with its content type and `Cache-Control: public, max-age=31536000, immutable`, and the manifest is rewritten to those keys (`scripts/media/publish-plan.ts`) and validated against `MediaManifest` before it goes up last, as `media/manifest.json` with `Cache-Control: public, max-age=300, must-revalidate`. A key's bytes therefore never change: the CDN and browsers may hold them for a year, a changed picture gets a new key instead of a stale copy, and a run uploads only the keys the bucket lacks, so it is idempotent and an interrupted run resumes. Objects the new manifest no longer names are counted and deleted only with `--prune`. The script sets the bucket's CORS rule (`GET`, `HEAD` from any origin; the files are public, and `*` lets a local checkout read models from the CDN too), and prints the rule for the dashboard when the token may not set it. It ends by reading the manifest back through the CDN and asking for one object with an `Origin`, and reports what it saw. The S3 client is sixty lines of Signature Version 4 in `scripts/media/r2.ts` against an injected `fetch`, tested on AWS's own vector; no SDK.

**The site** reads `CDN_BASE_URL` (validated as an http(s) URL) in `apps/web/lib/media.ts`. A local build, `public/media/manifest.json`, wins and names local files, as before. Without one, `apps/web/scripts/media-manifest.ts` fetches `${CDN_BASE_URL}/media/manifest.json` before `next build` and `next dev`, validates it against the schema, and writes it to git-ignored `apps/web/generated/media-manifest.json`; `loadMediaManifest` reads that copy and prefixes every `/media/` path in it with `CDN_BASE_URL`, so every `src`, `srcset`, `<video src>` and model URL on every page points at the CDN. A fetch that fails, or a manifest that does not validate, fails the build: a deploy configured for pictures and silently published without them is a broken deploy, and Vercel keeps the previous one live. Without `CDN_BASE_URL` nothing changes from ADR-009: no pictures. There are no rewrites, no proxy routes and no image optimizer in front of the CDN (`images.unoptimized` stays).

**The CDN** is the bucket's own public address. The owner chooses it: a custom domain (`media.coppercork.com`) is the CDN CLAUDE.md section 2 means, and needs coppercork.com added as a zone to his Cloudflare account with the Vercel records kept DNS-only; the `r2.dev` address works without touching DNS and is a stopgap. Because the published manifest keeps relative `/media/` paths and the site resolves them at build, moving from one address to the other is a change of `CDN_BASE_URL` on Vercel and a redeploy, not a re-upload.

**On Vercel**, `CDN_BASE_URL` is the one media variable, set for production and preview. It is a public address, not a secret. The `R2_*` credentials exist only in the owner's `.env.local`.

### The owner's decision

Publishing CIG's pictures and models to a public address is the owner's explicit decision, recorded here and in `docs/legal/cig-approval.md` (the four boxes ticked on his word, with the date) before anything was uploaded. TBD: his words and the date, or "declined" and this ADR stays proposed with no upload.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Commit the media, or copy them into the deploy | 1.7 GB in git or in every Vercel build; CLAUDE.md section 2 forbids serving them from the app server; every media folder is git-ignored by earlier ADRs for reasons that stand |
| Mirror the local paths as bucket keys with immutable caching | The names are not content-addressed; a changed picture at the same name would be stale at the edge and in browsers for a year. With a short lifetime instead, the CDN would help little. Content addressing at publish costs forty lines and makes idempotence a key lookup |
| Content-address in `prepare.ts` so local paths are hashed too | Touches every rendition path function, the schema's path comments and the e2e records for no local gain: local files are served by `next dev` from disk and need no cache busting. Hashing where the lifetime matters, at publish, leaves the local build as it was |
| Resolve a local manifest against `CDN_BASE_URL` as well | Its paths name local, unhashed files that are not in the bucket; resolving them would 404. The manifest and the files it names travel together, so the fetched manifest is resolved and a local one is not |
| Fetch the manifest at request time, or `fetch` in `loadMediaManifest` | `loadMediaManifest` is synchronous and called from many server components during static generation; the build step keeps it so, and keeps a flaky CDN from making pages differ |
| Proxy `/media/*` through a Next rewrite to the bucket | Routes every byte through the app server; CLAUDE.md section 2 names exactly this |
| The AWS SDK for the uploads | Four calls and a signature; the SDK is a large dependency for them, and the hand-rolled client is unit-tested against AWS's published vector and run with an injected `fetch` |
| `r2.dev` as the long-term address | Cloudflare documents it as rate-limited, uncached and for development; it is offered to the owner only as the stopgap that needs no DNS change |
| Wait for CIG's written approval before publishing | The owner's call; the boxes record whatever he decides, and the work stops at upload if he declines |

## Consequences

- The live site shows every picture and model the owner's machine has built, from the CDN. Pages that had no picture before (concepts without a matrix image, ships without a gallery) still have none; nothing here changes what the manifest lists.
- Publishing is a two-step owner routine after a media refresh: `pnpm exec tsx scripts/media/prepare.ts` then `pnpm exec tsx scripts/media/publish.ts`, from the checkout that holds the complete `fixtures/` copies, then a Vercel deploy (any push to `main`, or a redeploy) picks the new manifest up at build. `docs/runbooks/media.md` has the steps. Until that redeploy, the live site keeps the manifest its build fetched; a publish alone changes nothing on the site, by design.
- A Vercel build now makes one request to the CDN and fails if it cannot. Vercel keeps the previous deployment live on a failed build.
- Old keys accumulate in the bucket until a `--prune` run; at R2's storage price that is cents a month, and keeping them means a rolled-back deployment's manifest still resolves.
- `CDN_BASE_URL` is a `*`-origin public bucket: anyone may hotlink the files. They are CIG's public pictures, credited on the site; the exposure is the same as RSI's own media host.
- Spec 00's "Infrastructure provisioned" criterion is part met (R2 bucket with a public address; Neon, Fly and a CDN domain remain) and stays unticked. Spec 02's "Performance" criterion, "images served from R2 with width-appropriate variants", is now true in substance and stays unticked until its Lighthouse half is measured. Spec 05's "Caching" criterion, "models and images immutable with versioned paths", is met for the media by the content-addressed keys.
- CLAUDE.md section 9: the Vercel row gains `CDN_BASE_URL`; the variable list says what it is for. `.env.example` says the same. ADR-033's media note and `docs/runbooks/launch.md`'s media row point here.
- The e2e records and CI are unchanged: CI has no `CDN_BASE_URL`, so its builds behave as before, and `media.spec.ts` still holds either way.
- Implemented by the PR that adds this file.
