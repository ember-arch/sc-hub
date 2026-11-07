## Spec

Spec: `docs/specs/<NN>-<phase>.md`
Criteria addressed (ticked in the spec in this PR):

- [ ] <criterion>

## What changed

One paragraph. What a reviewer should look at first.

## Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] `pnpm test:e2e` green (if any page changed)
- [ ] Screenshots attached below for every page touched: 390 px and 1280 px, light and dark
- [ ] Lighthouse CI green on affected routes
- [ ] Preview URL:
- [ ] Fixture added or updated for any parser or normalizer change

## Rules check

- [ ] No hard-rule violations (`CLAUDE.md` section 2)
- [ ] No tokens added outside `packages/ui` (or an ADR is linked)
- [ ] Data contracts respected (`CLAUDE.md` section 5)
- [ ] Disclaimer and attribution unaffected or still passing their e2e test
- [ ] No secrets, no network in unit tests

## Decisions

ADR added or updated: <link or "none needed">

## Audit

Audit session findings and how each was handled (fixed / deferred with reason):

-

## Screenshots

