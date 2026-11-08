import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

// Concept review captures (ADR-008, ADR-009): the cinematic ship pages and the pages that show ship
// images and maker logos, at phone and desktop widths, written outside the screenshot folder the
// screens spec owns. They show local media when it has been built, which the committed screenshots
// never do (ADR-009: no CIG image enters git). Run on demand:
//   CONCEPT_OUT=<dir> pnpm exec playwright test e2e/concept-capture.spec.ts
// Skipped unless CONCEPT_OUT is set, so the suite never writes these by accident.

const out = process.env["CONCEPT_OUT"];

const PAGES: readonly (readonly [string, string])[] = [
  ["odin", "/ships/odin"],
  ["perseus", "/ships/perseus"],
  ["gladius", "/ships/gladius"],
  ["polaris", "/ships/polaris"],
  ["fury", "/ships/fury"],
  ["home", "/"],
  ["ships", "/ships"],
  ["aegis", "/manufacturers/aegis-dynamics"],
];

for (const [slug, path] of PAGES) {
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
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // A full-page capture does not scroll, so lazy card images would stay blank: load them all.
      await page.evaluate(async () => {
        const images = [...document.images];
        for (const image of images) image.loading = "eager";
        await Promise.all(
          images.map((image) =>
            image.complete ? undefined : image.decode().catch(() => undefined),
          ),
        );
      });
      mkdirSync(out ?? "", { recursive: true });
      await page.screenshot({
        path: join(out ?? "", `${slug}-${name}.png`),
        fullPage: true,
      });
      await context.close();
    });
  }
}
