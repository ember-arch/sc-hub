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
