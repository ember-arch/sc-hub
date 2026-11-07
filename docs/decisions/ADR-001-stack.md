# ADR-001: Technology stack

- Status: accepted
- Date: 2026-11-06
- Deciders: owner, scoping session

## Context

Solo builder with Claude Code, non-commercial, $150/month ceiling, three distinct workloads (per-patch extraction on a Windows PC, always-on pollers, a public site), heavy static assets (25 MB models), and a navigation model built on instant search. The owner's instruction was "build it the way Claude thinks is best; design is paramount."

## Decision

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces; TypeScript strict everywhere |
| Web | Next.js (App Router, latest stable), Tailwind generated from `packages/ui` tokens, a project component library on shadcn/ui primitives |
| 3D | React Three Fiber and drei; glTF with meshopt compression and KTX2 textures |
| Database | Postgres on Neon; Drizzle ORM and migrations |
| Search | Meilisearch on a small Fly.io machine |
| Object storage and CDN | Cloudflare R2 behind Cloudflare CDN; DNS and domain at Cloudflare |
| Workers | Fly.io machines for pollers and the import job; GitHub Actions for scheduled housekeeping |
| Extraction | StarBreaker (Rust CLI) driven by TypeScript scripts on the Windows PC |
| Model optimization | gltf-transform CLI; headless Three.js in Playwright for thumbnails and turntables |
| Schema contract | `packages/schema` Zod types, JSON Schema export for the pipeline |
| Observability | Sentry (free tier), self-hosted Umami, platform logs |
| CI | GitHub Actions: typecheck, lint, unit tests on fixtures, Playwright e2e and screenshots, Lighthouse CI, Vercel preview per PR |
| Auth | None in v1. Auth.js with RSI handle verification when the hangar module (v2) starts |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Fork FleetYards (Rails 6, Vue 2, GPLv3) | Dated stack; GPL would decide our license for us; the ship-matrix data model is shallower than DataCore |
| Postgres full-text search instead of Meilisearch | Not typo-tolerant or fast enough for a palette that is the primary navigation; the Fly machine costs about $7 a month |
| Supabase instead of Neon | Either works; Neon's scale-to-zero fits a hobby traffic curve better and we do not need Supabase's auth or realtime in v1 |
| Vercel Blob or S3 instead of R2 | Egress fees make 25 MB models expensive the moment a page is shared; R2 egress is free |
| Serverless cron (Vercel) for the Spectrum poller | Cannot hold a session; pollers need a long-lived process |
| Python pipeline | StarBreaker is a CLI either way; keeping the normalizers in TypeScript lets them share the Zod schema with the web app directly |
| scdatatools/StarFab as the primary extractor | Older, Blender-centric; StarBreaker exports assembled ships with materials to GLB from the command line. StarFab remains the fallback |

## Consequences

- One language (TypeScript) across pipeline, workers, and web; the Rust extractor is a black box we call.
- The Windows PC is a hard dependency for Phase 1 and Phase 4. `fixtures/` exists so everything else can be built without it.
- Meilisearch adds one machine to operate. Its index is rebuilt from Postgres, so it is disposable.
- Steady-state cost lands near $60 to $70 a month, within the envelope.
