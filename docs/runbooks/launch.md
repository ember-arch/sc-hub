# Runbook: the live site on Vercel

What exists, how it was set up, and what to do when something about the hosting changes. The decision is ADR-033.

## What exists

| Thing | Value |
| --- | --- |
| Vercel team | "Rift" (slug `riftbound`), Pro plan since 2026-11-10 |
| Project | `sc-hub`, Root Directory `apps/web`, framework Next.js, Node 24.x |
| Production branch | `main`; every push deploys production once the GitHub connection is in place |
| Build | Vercel runs the `build` script of `apps/web` (schema first, then the licence list, then `next build`). A bare `next build` fails: the schema package is consumed from its `dist/` |
| Domains | `coppercork.com` (canonical), `www.coppercork.com` (308 to the apex), `sc-hub-khaki.vercel.app` (Vercel's own) |
| DNS | At the registrar (Squarespace): apex A records to Vercel, `www` CNAME `cname.vercel-dns.com`. Kept from the earlier site; nothing to change |
| Media | None. `apps/web/public/media` is git-ignored and a deploy never has it; pages render without pictures (ADR-009, ADR-033) |

Environment variables on the project (none is a secret; `vercel env ls` shows them):

| Variable | Production | Preview | Why |
| --- | --- | --- | --- |
| `SITE_URL` | `https://coppercork.com` | unset | Canonicals, sitemap and Open Graph (CLAUDE.md section 9). A preview resolves the production URL Vercel injects, see `apps/web/lib/seo.ts` |
| `SC_HUB_CONTACT_EMAIL` | `ventures@coppercork.com` | same | The project's contact address (ADR-015, ADR-023). Nothing in `apps/web` reads it; set so the deployment carries it like every other runtime |
| `SPECTRUM_MODE` | `poll` | same | Turns the developer-post tab on (ADR-027); the box in `docs/legal/cig-approval.md` is ticked |
| `NEXT_TELEMETRY_DISABLED` | `1` | same | No network from the build beyond the registry, as in CI |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | same | Vercel then honours `packageManager: pnpm@12.18.0`; the lockfile is version 9.0, which Vercel would otherwise install with an older pnpm that does not know `allowBuilds` in `pnpm-workspace.yaml` |

## How it was set up (2026-11-10)

From a checkout of `main`, signed in to the Vercel CLI as the owner:

```
vercel project add sc-hub
vercel link --yes --project sc-hub          # writes .vercel/ (git-ignored)
vercel env add <NAME> production            # one per row above; value on stdin
vercel domains add coppercork.com sc-hub
vercel domains add www.coppercork.com sc-hub
```

Root Directory, Node version and the `www` redirect have no CLI flag and were set through the REST API with the CLI's own token (`PATCH /v9/projects/sc-hub` with `rootDirectory`, `framework`, `nodeVersion`; `PATCH /v9/projects/sc-hub/domains/www.coppercork.com` with `redirect` and `redirectStatusCode: 308`). The dashboard does the same under Settings → General and Settings → Domains.

The GitHub connection (Settings → Git) needs the owner's GitHub account connected to his Vercel account first; a CLI or API link attempt without it fails with "add a Login Connection".

## Checks after any deploy

1. `curl -sI https://coppercork.com` answers 200 from `Server: Vercel`; `curl -sI https://www.coppercork.com` answers 308 with `Location: https://coppercork.com/`.
2. `https://coppercork.com/robots.txt` allows `/`, disallows `/gallery`, names `https://coppercork.com/sitemap.xml`.
3. `https://coppercork.com/sitemap.xml` lists the ship, manufacturer and component pages with `https://coppercork.com` origins and nothing from `localhost`.
4. The footer on `/`, a ship page and `/news/dev` carries the verbatim disclaimer from `packages/ui/legal.ts` (CLAUDE.md section 2).
5. `/news/dev` shows developer posts (the Spectrum module is on).

## When the owner wants pictures live

Not a redeploy. The approval boxes in `docs/legal/cig-approval.md` are the gate, and then the media go to object storage behind a CDN with `CDN_BASE_URL` (CLAUDE.md section 2), never into the deploy. Separate ADR.

## Rolling back

Vercel keeps every production deployment: the dashboard's Deployments list → the previous one → "Promote to Production", or `vercel rollback` from a linked checkout.
