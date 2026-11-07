import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  DISCLAIMER,
  TRADEMARK_LINE,
  WIKI_CREDIT,
} from "../../../packages/ui/legal";

// Spec 00, criterion "Legal footer": the verbatim disclaimer and attribution lines render on
// every page; this asserts it on six routes (the ships index joined with spec 02) (docs/legal/obligations.md names the author page
// as the fifth, which arrives with the news spec; About stands in until then), plus a component
// page and a manufacturer page.

const ROUTES = [
  "/",
  "/ships",
  "/ships/gladius",
  "/components",
  "/news",
  "/about",
] as const;

for (const route of ROUTES) {
  test(`footer on ${route} carries the disclaimer, trademark line and wiki credit`, async ({
    page,
  }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const footer = page.locator("footer").last();
    await expect(footer.getByTestId("disclaimer")).toHaveText(DISCLAIMER);
    await expect(footer).toContainText(TRADEMARK_LINE);
    await expect(footer).toContainText(WIKI_CREDIT.text);
    await expect(
      footer.getByRole("link", { name: "robertsspaceindustries.com" }),
    ).toHaveAttribute("href", "https://robertsspaceindustries.com/");
  });
}

test("a component page and a manufacturer page carry the footer too", async ({
  page,
}) => {
  for (const route of [
    "/components/aegis-gladius-noise-launcher",
    "/manufacturers/aegis-dynamics",
  ]) {
    const response = await page.goto(route);
    // Slugs come from the pack; if one changes the test should say so rather than pass on a 404.
    expect(response?.status(), route).toBe(200);
    await expect(
      page.locator("footer").last().getByTestId("disclaimer"),
    ).toHaveText(DISCLAIMER);
  }
});

// Spec 00, criterion "Patch strip": LIVE and PTU version strings from GameVersion rows (fixture
// values for now) on home and in the footer. The expected strings are read from the pack itself.
interface GameVersionRow {
  channel: string;
  version: string;
  is_current: boolean;
}
const gameVersions = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../../fixtures/bootstrap/GameVersion.json", import.meta.url),
    ),
    "utf8",
  ),
) as GameVersionRow[];
const current = (channel: string): string | undefined =>
  gameVersions.find((v) => v.channel === channel && v.is_current)?.version;

test("the patch strip shows each channel's current build from the pack on home and in the footer", async ({
  page,
}) => {
  await page.goto("/");
  const strips = page.locator("dl").filter({ hasText: "LIVE" });
  await expect(strips).toHaveCount(2);
  for (const channel of ["LIVE", "PTU"]) {
    const version = current(channel);
    for (const strip of [strips.first(), strips.last()]) {
      const slot = strip.locator("div").filter({ hasText: channel });
      await expect(slot).toContainText(version ?? "no build recorded");
    }
  }
  // The LIVE build string is a real fixture value, not a label.
  expect(current("LIVE")).toMatch(/^\d+\.\d+/);
});
