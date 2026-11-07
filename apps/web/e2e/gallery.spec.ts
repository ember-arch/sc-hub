import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { storyMeta } from "../../../packages/ui/stories/ids";

// Spec 00, criterion "Core components": each component with a light and dark screenshot in
// packages/ui/__screenshots__/, taken from the gallery route (ADR-005).

const OUT = fileURLToPath(
  new URL("../../../packages/ui/__screenshots__/", import.meta.url),
);

for (const story of storyMeta) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${story.id} (${scheme})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: story.width, height: 900 },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const response = await page.goto(`/gallery/${scheme}/${story.id}`);
      expect(response?.status()).toBe(200);
      const target = page.locator("[data-story]");
      await expect(target).toBeVisible();
      mkdirSync(OUT, { recursive: true });
      const path = join(OUT, `${story.id}-${scheme}.png`);
      if (story.capture === "viewport") await page.screenshot({ path });
      else await target.screenshot({ path });
      await context.close();
    });
  }
}
