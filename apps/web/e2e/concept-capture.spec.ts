import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

// Concept review captures (ADR-008): the cinematic Gladius and Polaris pages at phone and desktop
// widths, written outside the screenshot folder the screens spec owns. Run on demand:
//   CONCEPT_OUT=<dir> pnpm exec playwright test e2e/concept-capture.spec.ts
// Skipped unless CONCEPT_OUT is set, so the suite never writes these by accident.

const out = process.env["CONCEPT_OUT"];

for (const slug of ["gladius", "polaris"]) {
  for (const [name, width] of [
    ["phone", 390],
    ["desktop", 1280],
  ] as const) {
    test(`concept ${slug} at ${width} px`, async ({ browser }) => {
      test.skip(out === undefined, "set CONCEPT_OUT to capture");
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto(`/ships/${slug}`);
      mkdirSync(out ?? "", { recursive: true });
      await page.screenshot({
        path: join(out ?? "", `${slug}-${name}.png`),
        fullPage: true,
      });
      await context.close();
    });
  }
}
