# ADR-033: The site goes live on Vercel at coppercork.com, words and data first

- Status: accepted (owner direction 2026-11-10: "once we are done building we are going to launch this live as coppercork.com"; the owner upgraded the Vercel team the same day, "I also upgraded vercel -- should be good to go now")
- Date: 2026-11-10
- Deciders: owner, Claude Code session 2026-11-10

## Context

CLAUDE.md section 3 has always named Vercel as the runtime for `apps/web`, and section 8 requires a Vercel preview deployment for every PR, which no PR has had: the PR template's "Preview URL" box has never been tickable. On 2026-11-10 the owner asked for the site to go live at coppercork.com, the domain he kept from the earlier Coppercork TCG site that ran on Vercel until 2026-10-29.

What the deploy has to work with:

- The site reads committed fixture packs (`fixtures/bootstrap`, `fixtures/news`, and the rest listed in `apps/web/next.config.ts`), so it needs no database or search service yet. `packages/schema/env.ts` lists those for the web role, but nothing in `apps/web` calls `loadEnv("web")`; the pages read the packs directly.
- Every picture and model lives in the git-ignored `apps/web/public/media`, built locally by `scripts/media/prepare.ts` from git-ignored copies of RSI's and the wiki's files (ADR-009, ADR-024, ADR-025). A deploy has none of it, and the pages render without images by design.
- `docs/legal/cig-approval.md` has the RSI website images, wiki gallery pictures, holoviewer models and title icons boxes unticked. Those pictures stay local until the owner ticks them. The Spectrum republication box is ticked (2026-11-10), so the dev tracker may show on the public site.
- `apps/web/lib/seo.ts` throws in a production build without `SITE_URL`, so canonicals, the sitemap and Open Graph never publish a placeholder origin.
- The name is still an open decision (CLAUDE.md section 12). `docs/legal/obligations.md` requires that the domain not contain Star Citizen, Squadron 42, RSI, Roberts Space Industries, Spectrum or Cloud Imperium; coppercork.com contains none of them.

What was found on 2026-11-10:

- The owner's Vercel account (team "Rift", slug `riftbound`, Hobby plan) still holds the domain coppercork.com, and the registrar's records (Squarespace nameservers) still point at Vercel: the apex at Vercel's A records and `www` at `cname.vercel-dns.com`. No DNS change is needed; both names currently answer `DEPLOYMENT_NOT_FOUND` because no project claims them.
- The team was paused by Vercel for exceeding the Hobby plan's fair-use limits (reason `FAIR_USE_LIMITS_EXCEEDED`, overage type `fluidCpuDuration`), paused since 2026-10-30 23:55 UTC with an automatic unpause at 2026-11-29 23:55 UTC. The earlier Coppercork site's serverless usage is the only workload that team ever ran. While paused the team refused to create a project (HTTP 402). The owner chose to upgrade the team to Pro rather than wait, which lifted the pause at once.

## Decision

The site is served by Vercel from one project for `apps/web` (Root Directory `apps/web`, the pnpm workspace installed from the repository root, Node 24 and pnpm 12.18.0 via `packageManager` with Corepack enabled), production from `main` with a preview deployment on every pull request through the Vercel GitHub app. The apex coppercork.com is the canonical origin; `www.coppercork.com` redirects to it with a 308. The production environment carries `SITE_URL=https://coppercork.com`, `SC_HUB_CONTACT_EMAIL=ventures@coppercork.com` and `SPECTRUM_MODE=poll`, plus `NEXT_TELEMETRY_DISABLED=1`; preview deployments carry the same except `SITE_URL`, which `seo.ts` then resolves from the production URL Vercel injects. No secret is involved and none enters the repository.

The first launch shows words and data only: every page, the register, the ship files, the almanac sections, the dispatches and the developer posts, all without a single CIG picture or model, because the deploy has no media folder and the approval boxes are unticked. The name question stays open; coppercork.com is the domain the owner already owns and it satisfies `docs/legal/obligations.md`, which is all this ADR claims about it.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Ship the pictures and models with the first launch | The approval boxes in `docs/legal/cig-approval.md` are unticked; CLAUDE.md section 2 forbids routing large assets through the app server, so pictures would need object storage behind a CDN (R2 was always the plan, ADR-001) and a `CDN_BASE_URL` path in `prepare.ts`. Both are a separate piece of work and the second depends on the owner's decision on the first |
| `www` as the canonical host | The TCG site used the apex; the owner named the apex; one canonical keeps the sitemap and the JSON-LD consistent |
| A second Hobby team to get around the pause | Vercel's fair-use terms treat that as circumvention, and the domain is held by the paused team |
| Another host (Cloudflare Workers via OpenNext, Netlify) | CLAUDE.md names Vercel, CI's comments already assume the Vercel GitHub app for preview links, and the paused team is a billing question, not a technical one |

## Consequences

- Hosting now costs 20 USD a month (Vercel Pro). What exists, every environment variable and the checks after a deploy are in `docs/runbooks/launch.md`.
- The GitHub connection needs the owner's GitHub account connected to his Vercel account; a link attempt without it fails with "add a Login Connection". Until he connects it, production deploys come from the CLI and PRs get no preview link.
- Every data commit the News workflow lands on `main` (every two hours, ADR-027, ADR-031) and the daily refresh (ADR-023) will trigger a production deployment once the GitHub connection is in place. That is the intended way the published news stays current. It also means `main` is deployed without the e2e and Lighthouse gates, which ADR-030 already accepts for pushes to `main` that came through a PR.
- The PR template's "Preview URL" box becomes tickable: the Vercel GitHub app comments the preview link on every PR. CLAUDE.md section 8, item 4, is satisfiable for the first time.
- CLAUDE.md section 9 lists Postgres read and Meilisearch read for Vercel; neither exists yet and the site does not need them to serve the packs. That row is unchanged here; it describes the architecture the specs still aim at.
- Pictures on the live site are a separate decision and a separate piece of work: the owner ticks the boxes he is willing to stand behind, then the media go to object storage behind a CDN with `CDN_BASE_URL` (CLAUDE.md section 2).
- `.vercel/` is git-ignored: the CLI writes the project link there.
