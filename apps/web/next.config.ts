import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig: NextConfig = {
  // packages/ui ships TypeScript source (ADR-005).
  transpilePackages: ["ui"],
  // Monorepo: trace from the repository root so the fixture pack the Phase 0 site reads is bundled.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": [
      "../../fixtures/bootstrap/**",
      "../../fixtures/news/**",
      "../../fixtures/descriptions/**",
      "../../fixtures/ship-matrix/**",
      // Prices, loaners and claims are read per request by /compare and /ships?view=table too.
      "../../fixtures/acquisition/**",
      "../../fixtures/ship-claims/**",
      "../../fixtures/titles/Titles.json",
      "../../fixtures/funding/Funding.json",
      "../../pnpm-workspace.yaml",
      // The media manifest fetched from the CDN at build (ADR-034), read per request by the same
      // routes for their card pictures; absent when CDN_BASE_URL is unset.
      "generated/media-manifest.json",
    ],
    // The build snapshots (ADR-049), read per request by /patches/compare only.
    "/patches/**": ["../../fixtures/patches/*.json.gz"],
  },
  // No image optimizer: the pictures are pre-sized WebP renditions (scripts/media/prepare.ts)
  // served as static files locally and from the CDN in a deploy (ADR-009, ADR-034).
  images: { unoptimized: true },
  poweredByHeader: false,
  // The ledger page is folded into the front page (ADR-040); its address, published since
  // ADR-018, lands on the home's funding card.
  redirects: async () => [
    { source: "/funding", destination: "/#funding", permanent: true },
  ],
};

export default nextConfig;
