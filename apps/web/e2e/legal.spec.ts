import { expect, test } from "@playwright/test";
import {
  DISCLAIMER,
  TRADEMARK_LINE,
  WIKI_CREDIT,
} from "../../../packages/ui/legal";

// Spec 00, criterion "Legal footer": the verbatim disclaimer and attribution lines render on
// every page; this asserts it on five routes (docs/legal/obligations.md names the author page
// as the fifth, which arrives with spec 03; About stands in until then).

const ROUTES = [
  "/",
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

test("the patch strip shows the LIVE build on home and in the footer", async ({
  page,
}) => {
  await page.goto("/");
  const strips = page.locator("dl").filter({ hasText: "LIVE" });
  await expect(strips.first()).toContainText(/LIVE\s*\d+\.\d+/);
  await expect(page.locator("footer").last()).toContainText("PTU");
});
