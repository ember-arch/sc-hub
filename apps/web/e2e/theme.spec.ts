import { expect, test } from "@playwright/test";

// ADR-021: the theme switch in the header. The choice applies at once, is kept across a reload
// and applied before the first paint; without a choice the site follows the system.

test("the switch turns dark mode on, and the choice survives a reload", async ({
  page,
}) => {
  await page.goto("/ships");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", /./);
  const toggle = page.getByRole("switch", { name: /Dark mode/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAccessibleName("Dark mode on");

  // The stored choice is applied by the inline script, before hydration.
  await page.goto("/titles");
  expect(
    await page.evaluate(() => document.documentElement.dataset["theme"]),
  ).toBe("dark");
  await expect(
    page.getByRole("switch", { name: "Dark mode on" }),
  ).toHaveAttribute("aria-checked", "true");

  // And off again.
  await page.getByRole("switch", { name: /Dark mode/ }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "light",
  );
});

// ADR-045: the header's logo is the home link, named for the site, one lockup per scheme.
test("the logo is the home link, named Coppercork, and shows the lockup for the scheme", async ({
  browser,
}) => {
  for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await page.goto("/");
    const home = page
      .getByRole("banner")
      .getByRole("link", { name: "Coppercork", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    const shown = await home
      .locator("img")
      .evaluateAll((imgs) =>
        imgs
          .filter((img) => getComputedStyle(img).display !== "none")
          .map((img) => img.getAttribute("src")),
      );
    expect(shown, scheme).toEqual([`/brand/coppercork-${scheme}.svg`]);
    await context.close();
  }
});

test("without a choice the switch reports the system's scheme", async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  await expect(page.getByRole("switch", { name: /Dark mode/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await context.close();
});
