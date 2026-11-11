import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 08 (ADR-049): the patch pages. Builds are read from fixtures/patches, so a new build
// changes the data, not this file.

const here = dirname(fileURLToPath(import.meta.url));
const codes = readdirSync(join(here, "../../../fixtures/patches"))
  .filter((f) => /^\d.*-LIVE\.\d+\.json$/.test(f))
  .map((f) => f.slice(0, -".json".length));
const version = (code: string) => code.split("-")[0]!;
const order = (a: string, b: string) => {
  const pa = version(a).split(".").map(Number);
  const pb = version(b).split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
  return Number(a.split(".").at(-1)) - Number(b.split(".").at(-1));
};
codes.sort(order);
const newest = codes.at(-1);
const previous = codes.at(-2);

test.describe("the patch pages", () => {
  test.skip(previous === undefined, "two LIVE builds are needed");

  test("the latest patch opens on the two builds, the figures and the sections in CIG's order", async ({
    page,
  }) => {
    const response = await page.goto("/patches");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "What changed",
    );
    const views = page.getByRole("navigation", { name: "Patch views" });
    await expect(views.getByRole("link")).toHaveCount(3);
    await expect(views.getByRole("link", { name: /^Latest/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(newest!, { exact: true })).toBeVisible();
    const headings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(headings).toEqual([
      "Ships and vehicles",
      "Weapons and parts",
      "Crafting",
      "Patch notes",
      "Sources",
    ]);
    // The header names the section.
    await expect(
      page.getByRole("link", { name: "Patches", exact: true }).first(),
    ).toHaveAttribute("aria-current", "page");
  });

  test("an entry opens on its figure table, with both builds and the change", async ({
    page,
  }) => {
    await page.goto("/patches");
    const entry = page.locator("[data-patch-entry]").first();
    test.skip((await entry.count()) === 0, "no entry changed");
    await entry.locator("summary").click();
    const table = entry.locator("table").first();
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toContainText([
      /Figure|Port|Ingredient/,
    ]);
  });

  test("the filter narrows the entries by name and says how many match", async ({
    page,
  }) => {
    await page.goto("/patches");
    const entries = page.locator("[data-patch-entry]");
    test.skip((await entries.count()) < 2, "fewer than two entries");
    const name = (
      await entries
        .first()
        .locator("summary span.text-primary")
        .first()
        .textContent()
    )?.trim();
    expect(name).toBeTruthy();
    const field = page.getByLabel(
      "Find a ship, part or blueprint in this patch",
    );
    await field.fill(name!);
    await expect(
      page.getByRole("status").filter({ hasText: /match/ }),
    ).toBeVisible();
    await expect(entries.first()).toBeVisible();
    const hidden = await page.locator("[data-patch-entry][hidden]").count();
    expect(hidden).toBeGreaterThan(0);
    await field.fill("");
    expect(await page.locator("[data-patch-entry][hidden]").count()).toBe(0);
  });

  test("compare takes two builds in either order and shows the newer first", async ({
    page,
  }) => {
    const response = await page.goto(
      `/patches/compare?from=${version(newest!)}&to=${version(previous!)}`,
    );
    expect(response?.status()).toBe(200);
    // The newer build stands first in the head, whichever order the address gave.
    const builds = page.locator("main [data-build]");
    await expect(builds.first()).toHaveText(newest!);
    await expect(builds.nth(1)).toHaveText(previous!);
    await expect(
      page.getByRole("link", { name: "Compare", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("an earlier patch has its own page", async ({ page }) => {
    test.skip(codes.length < 3, "three LIVE builds are needed");
    const earlier = version(previous!);
    const response = await page.goto(`/patches/${earlier}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `What changed in ${earlier}`,
    );
  });

  test("the PTU page says what is on record for the build in testing", async ({
    page,
  }) => {
    const response = await page.goto("/patches/ptu");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "On the PTU",
    );
    await expect(page.getByRole("link", { name: /^PTU/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("an unknown patch is a 404", async ({ page }) => {
    const response = await page.goto("/patches/0.0.1");
    expect(response?.status()).toBe(404);
  });
});
