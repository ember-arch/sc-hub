import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

// Spec 02, criterion "Accessibility": a keyboard-only run through the index, a ship page, compare
// and the palette, recorded as a Playwright test. No pointer is used after the first navigation;
// every stop checks that the focused element shows a focus ring (system.md section 6).

interface VehicleRow {
  slug: string;
  name: string;
}
const vehicles = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../../fixtures/bootstrap/Vehicle.json", import.meta.url),
    ),
    "utf8",
  ),
) as VehicleRow[];
const byName = [...vehicles].sort((a, b) => a.name.localeCompare(b.name, "en"));
const first = byName[0];
if (first === undefined) throw new Error("pack has no ships");

/** Tabs until the focused element matches `locator`, failing after `limit` stops. */
async function tabTo(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  limit = 60,
): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press("Tab");
    const match = await locator.evaluate(
      (el) => el === document.activeElement,
      undefined,
      { timeout: 2_000 },
    );
    if (match) return;
  }
  throw new Error("did not reach the target with Tab");
}

/** The focused element draws an outline (focus-visible), not just a color change. */
async function expectFocusRing(page: Page): Promise<void> {
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(ring, "something is focused").not.toBeNull();
  expect(ring?.style, `${ring?.tag} has an outline style`).not.toBe("none");
  expect(ring?.width, `${ring?.tag} has an outline width`).not.toBe("0px");
}

test("index, ship page, compare and the palette are operable with the keyboard alone", async ({
  page,
}) => {
  await page.goto("/ships");

  // Index: skip link, then the first filter, then step it with the arrows and apply with Enter.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await expectFocusRing(page);
  const size = page.getByLabel("Size");
  await tabTo(page, size);
  await expectFocusRing(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ships\?size=/);
  await expect(size).toBeFocused();

  // Clear with the keyboard, then open the first ship card.
  const clear = page.getByRole("link", { name: "Clear filters" });
  await tabTo(page, clear);
  await expectFocusRing(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ships$/);
  const card = page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^${first.name}`) })
    .first();
  await tabTo(page, card);
  await expectFocusRing(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/ships/${first.slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(first.name);

  // Ship page: add to compare with Space, then follow the compare link with Enter.
  const toggle = page.getByRole("button", { name: `Compare ${first.name}` });
  await tabTo(page, toggle);
  await expectFocusRing(page);
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const compareLink = page.getByRole("link", { name: "Compare 1 ship" });
  await tabTo(page, compareLink);
  await expectFocusRing(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/compare\\?ships=${first.slug}$`));

  // Compare: add a second ship through the select, then remove the first with its link.
  const add = page.getByLabel("Add a ship", { exact: true });
  await tabTo(page, add);
  await expectFocusRing(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/compare\\?ships=${first.slug},`));
  await expect(page.getByTestId("compare-count")).toContainText("2 of 4 ships");
  const remove = page.getByRole("link", {
    name: `Remove ${first.name} from the comparison`,
  });
  await tabTo(page, remove);
  await expectFocusRing(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/compare\?ships=[a-z0-9-]+$/);
  await expect(page.getByTestId("compare-count")).toContainText("1 of 4 ships");

  // Palette: open with the shortcut, type, pick with the arrows and Enter.
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await page.keyboard.type(first.name.slice(0, 3));
  await expect(dialog.getByRole("option").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/(ships|components|manufacturers)\//);
  await expect(dialog).toBeHidden();
});
