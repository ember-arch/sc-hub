# Spec 05 — Launch

- Phase: 5 (weeks 15 to 16)
- Machine: laptop or cloud session
- Gate: one week of live traffic with no P1 incident; every item below ticked

## Goal

Turn a working preview into a public site that survives a Reddit front page and a patch day without the owner at the keyboard.

## Acceptance criteria

- [ ] **Name and domain.** Name decided (`CLAUDE.md` section 12), domain live at Cloudflare, `SITE_NAME` set, CIG has seen the name (approval record box). (The site is live at coppercork.com since 2026-11-10 with the DNS at the registrar pointing at Vercel, ADR-033; the name and the CIG part are still open.)
- [ ] **License.** Decided and recorded; `LICENSE` file added with the asset and data exclusion stated at the top; about page states it.
- [ ] **Performance pass.** Lighthouse performance ≥ 90 and accessibility ≥ 90 on home, ships index, a hero ship page, a non-hero ship page, a component page, news feed, dev tracker, author page, at throttled 4G, in CI.
- [ ] **Caching.** Entity pages cached at the edge with revalidation on import; feed pages revalidate every 5 minutes; models and images immutable with versioned paths; a cache-bust is part of the import job.
- [ ] **Load test.** A k6 or autocannon run against the preview at 50 requests per second for 10 minutes on a mix of pages with p95 under 500 ms and no errors; Neon and Fly metrics attached.
- [ ] **SEO and social.** Sitemap submitted, robots correct, every page has an Open Graph image (pipeline thumbnail or fankit render), structured data validates.
- [ ] **Legal pages final.** Disclaimer verified against the current fan-site rules page (copy date updated), attribution lines complete, privacy page, licenses route, contact address live and monitored.
- [ ] **Takedown drill.** Flag one content item, one author, and one model on production; confirm 410, search purge, and CDN purge; record times in the PR.
- [ ] **Observability.** Sentry receiving errors with IP scrubbing; Umami live; uptime check on home and a ship page with alerts to the owner's phone; poller health dashboard (last success per source) on the admin route.
- [ ] **Backups.** Neon point-in-time recovery confirmed; R2 bucket versioning on; a restore drill documented in `docs/runbooks/restore.md` and executed once against a scratch database.
- [ ] **Runbooks.** `patch-day.md` run end to end on the most recent build by the owner alone, following the document, with no help from Claude Code; corrections folded in.
- [ ] **Launch post.** A short Spectrum post and a r/starcitizen post drafted by the owner (not generated), stating what the site is, that it is a fan project, and where to send corrections.
- [ ] **Soft launch.** Posted; one week of monitoring; issues triaged into v1.1 spec; no P1 (site down, wrong data on LIVE, legal complaint) during the week.

## Suggested order

1. Name, domain, license (owner decisions; unblock first).
2. Performance and caching; load test.
3. SEO, OG, legal pages.
4. Observability, backups, takedown drill.
5. Runbook rehearsal by the owner.
6. Launch post and monitoring week.

## Verification

Every criterion has an attachment: a report, a screenshot, a timestamp, or a link. The audit session reviews the whole repo against `CLAUDE.md` one final time before the public post.

## After launch

The first two patch cycles are the real test of Phase 1. Only after both import cleanly does the v2 loadout calculator get a spec.
