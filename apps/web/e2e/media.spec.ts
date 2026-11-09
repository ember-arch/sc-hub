import { type Page, expect, test } from "@playwright/test";

// ADR-009: images are local copies listed in a git-ignored manifest, so a fresh clone and CI have
// none. These checks hold either way: whatever images a page draws have loaded, are sized, and a
// ship image is credited to RSI with a link to its source. With no images they pass trivially.

async function drawnImages(page: Page) {
  return page.locator("img").evaluateAll((imgs) =>
    imgs
      .filter((img) => getComputedStyle(img).display !== "none")
      .map((img) => {
        const el = img as HTMLImageElement;
        return {
          src: el.currentSrc,
          complete: el.complete,
          naturalWidth: el.naturalWidth,
          hasSize:
            el.getAttribute("width") !== null &&
            el.getAttribute("height") !== null,
          alt: el.getAttribute("alt"),
        };
      }),
  );
}

for (const route of [
  "/",
  "/ships/gladius",
  "/ships/polaris",
  "/ships/perseus",
  "/ships/odin",
  "/manufacturers/aegis-dynamics",
  "/manufacturers/mirai",
]) {
  test(`every image drawn on ${route} loads and is sized`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(route);
    await page.waitForLoadState("load");
    // Scroll through like a reader so lazy images below the fold load too. The page grows as
    // figures and viewers load, so its height is measured again at every step.
    const height = () => page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < (await height()); y += 700) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(60);
    }
    await page.waitForLoadState("networkidle");
    for (const img of await drawnImages(page)) {
      expect(img.complete, img.src).toBe(true);
      expect(img.naturalWidth, img.src).toBeGreaterThan(0);
      expect(img.hasSize, img.src).toBe(true);
      expect(img.alt, img.src).not.toBeNull();
    }
  });
}

test("a ship image is described and credited to RSI with a link to its source", async ({
  page,
}) => {
  await page.goto("/ships/gladius");
  const stage = page.locator("section[aria-labelledby='ship-name']");
  const image = stage.locator("img").first();
  if ((await image.count()) === 0) test.skip(true, "no media built locally");
  await expect(image).toHaveAttribute("alt", "The Gladius");
  await expect(image).not.toHaveAttribute("loading", "lazy");
  const credit = stage.getByRole("link", {
    name: "Image: Roberts Space Industries",
  });
  await expect(credit).toHaveAttribute(
    "href",
    /^https:\/\/robertsspaceindustries\.com\/pledge\/ships\//,
  );
});

test("the Odin's images and render loops sit in the sections they show (ADR-014)", async ({
  page,
}) => {
  await page.goto("/ships/odin");
  const combat = page.locator("#combat");
  if ((await combat.locator("video").count()) === 0)
    test.skip(true, "no media built locally");
  // Weapons and combat is section 3 (ADR-015).
  await expect(combat.locator("figcaption").first()).toContainText("Fig. 3.1");
  await expect(
    page.locator("#operations figcaption", { hasText: "The bridge" }),
  ).toHaveCount(1);
  await expect(page.locator("#specifications img").first()).toBeAttached();
  // The opening band carries the key art and its credit.
  const stage = page.locator("section[aria-labelledby='ship-name']");
  await expect(stage.locator("img").first()).toBeAttached();
  await expect(
    stage.getByRole("link", { name: "Art: Roberts Space Industries" }),
  ).toBeVisible();
});

test("a maker logo shows one version for the page's theme", async ({
  page,
}) => {
  await page.goto("/ships/gladius");
  const logos = page.getByRole("img", { name: "Aegis Dynamics logo" });
  if ((await logos.count()) === 0) test.skip(true, "no media built locally");
  // Ship pages are dark: only the light mark is drawn, and it is the one the reader can find.
  await expect(logos).toHaveCount(1);
  await expect(logos).toHaveAttribute("src", /aegs-on-dark/);
});

// ADR-015: with the models built, Scale lines every ship up in one holoviewer canvas.
test("Scale lines the ships up in the holoviewer, opening on the page's ship and its neighbours", async ({
  page,
}) => {
  await page.goto("/ships/gladius");
  const scale = page.locator("#scale");
  const lineup = scale.getByRole("img", {
    name: /^To scale, from RSI's holoviewer models/,
  });
  if ((await lineup.count()) === 0) test.skip(true, "no models built locally");
  await expect(lineup).toHaveAttribute("aria-label", /Gladius 21 m/);
  await expect(
    scale.getByRole("button", { name: "Around the Gladius" }),
  ).toHaveAttribute("aria-pressed", "true");
  await scale.getByRole("button", { name: "All ships" }).click();
  await expect(
    scale.getByRole("button", { name: "All ships" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(scale.getByRole("button", { name: /^Odin/ })).toBeVisible();
});
