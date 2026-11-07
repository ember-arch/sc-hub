# packages/ui

Design tokens and components, no app logic (ADR-005).

- `tokens.ts` holds every value in `docs/design/system.md` section 2 and nothing else. `pnpm --filter ui build:tokens` writes `tokens.css`, the Tailwind 4 theme the site imports; `__tests__/tokens.test.ts` fails when the file is stale or a value drifts from the design document. Changing a value needs an ADR.
- `brand.ts` holds the working title (`SITE_NAME`, CLAUDE.md section 12) and `legal.ts` the verbatim disclaimer, trademark line and credits with their sources.
- `components/` is the Phase 0 set from the design system plus the spec 02 additions (`FilterBar`, `SegmentedLinks`; ADR-006); `index.ts` is the public surface. Components are TypeScript source consumed by `apps/web` through `transpilePackages`; `next/link` and `next/navigation` (the palette and the filter bar navigate) are the only framework imports.
- `stories/` renders each component from fixture rows for the gallery route in `apps/web`; Playwright writes one light and one dark screenshot per story into `__screenshots__/`.
