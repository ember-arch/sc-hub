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
      "../../pnpm-workspace.yaml",
    ],
  },
  // No image optimizer in Phase 0: the only images will be fankit renders served from the CDN later.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
