import { expect, test } from "@playwright/test";

// Spec 00, criterion "Command palette": opens with ⌘K and from the persistent button, searches
// fixture entities client-side, keyboard navigable, closes on escape.

test("opens with the keyboard shortcut, navigates with arrows and enter, closes on escape", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  // The first keypress can land before hydration attaches the listener; retry until it opens.
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass();
  const input = dialog.getByRole("combobox");
  await expect(input).toBeFocused();

  await input.fill("gla");
  const options = dialog.getByRole("option");
  await expect(options.first()).toContainText("Gladius");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.keyboard.press("ControlOrMeta+k");
  await dialog.getByRole("combobox").fill("gladius");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ships\/gladius$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gladius");
});

test("opens from the search button and groups results by entity type", async ({
  page,
}) => {
  await page.goto("/ships");
  await page.getByRole("button", { name: "Search ⌘K" }).click();
  const dialog = page.getByRole("dialog", { name: "Search" });
  await dialog.getByRole("combobox").fill("aegis");
  await expect(dialog.getByRole("group", { name: "Ships" })).toBeVisible();
  await expect(
    dialog.getByRole("group", { name: "Manufacturers" }),
  ).toBeVisible();
});

test("the home search field opens the palette", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Search ships, components, manufacturers and titles/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
});

test("remembers recently opened entities", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Search" });
  // A keypress can land before hydration attaches the listener; retry until the dialog opens.
  const open = () =>
    expect(async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(dialog).toBeVisible({ timeout: 500 });
    }).toPass();
  await page.goto("/");
  await open();
  await dialog.getByRole("combobox").fill("polaris");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ships\/polaris$/);
  await open();
  await expect(dialog).toContainText("Recent ships");
  await expect(page.getByRole("option", { name: /Polaris/ })).toBeVisible();
});
