import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Spec 08 (ADR-049): the patch pages. Builds are read from fixtures/patches, so a new build
// changes the data, not this file.

const here = dirname(fileURLToPath(import.meta.url));
const codes = readdirSync(join(here, "../../../fixtures/patches"))
  .filter((f) => /^\d.*-LIVE\.\d+\.json\.gz$/.test(f))
  .map((f) => f.slice(0, -".json.gz".length));
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
    // ADR-055: From is the earlier build, To the latest.
    const head = page.locator("[data-comparison] [data-build]");
    await expect(head.first()).toHaveText(previous!);
    await expect(head.last()).toHaveText(newest!);
    const headings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    // A version CIG released ahead of its figures leads in one line (ADR-049, amended); the
    // comparison's sections follow straight after either way.
    const ahead = /^\d+\.\d+\.\d+ is live$/.exec(headings[0] ?? "");
    expect(headings.slice(ahead === null ? 0 : 1)).toEqual([
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
    // A changed entry opens on a table of both builds; a new or removed one on its figures.
    await expect(entry.locator("table, dl").first()).toBeVisible();
    const changed = page.locator("#ships details[data-patch-entry]").filter({
      has: page.locator("summary", { hasText: /changes?$/ }),
    });
    if ((await changed.count()) > 0) {
      await changed.first().locator("summary").click();
      const table = changed.first().locator("table").first();
      await expect(table.getByRole("columnheader")).toContainText([
        /Figure|Port|Ingredient/,
      ]);
    }
  });

  // ADR-055: the comparison reads From → To, and the tables say Before and After.
  test("the head reads From, then To, and an entry's table says Before and After", async ({
    page,
  }) => {
    await page.goto("/patches");
    const head = page.locator("[data-comparison]");
    await expect(head).toBeVisible();
    const text = (await head.textContent()) ?? "";
    expect(text.indexOf("From")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("From")).toBeLessThan(text.indexOf("To"));
    // A changed entry's own line ends on its count of changes.
    const changed = page.locator("#ships details[data-patch-entry]").filter({
      has: page.locator("summary", { hasText: /changes?$/ }),
    });
    test.skip((await changed.count()) === 0, "no ship changed");
    await changed.first().locator("summary").click();
    const heads = changed
      .first()
      .locator("table")
      .first()
      .getByRole("columnheader");
    await expect(heads.filter({ hasText: "Before" })).toHaveCount(1);
    await expect(heads.filter({ hasText: "After" })).toHaveCount(1);
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

  test("compare takes two builds in either order and reads From the older To the newer", async ({
    page,
  }) => {
    const response = await page.goto(
      `/patches/compare?from=${version(newest!)}&to=${version(previous!)}`,
    );
    expect(response?.status()).toBe(200);
    // The older build is From and the newer To, whichever order the address gave (ADR-055).
    const builds = page.locator("[data-comparison] [data-build]");
    await expect(builds.first()).toHaveText(previous!);
    await expect(builds.nth(1)).toHaveText(newest!);
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

  // ADR-055: with every fold open, the patch pages fit a phone, the hotfix page included.
  test("every fold open, the patch pages do not scroll sideways at 390 px", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
    });
    const page = await context.newPage();
    const hotfix = codes.find(
      (c) => codes.filter((o) => version(o) === version(c)).length > 1,
    );
    const paths = ["/patches"];
    if (hotfix !== undefined) {
      const later = codes.filter((o) => version(o) === version(hotfix)).at(-1)!;
      paths.push(`/patches/${version(later)}-${later.split(".").at(-1)}`);
    }
    for (const path of paths) {
      const response = await page.goto(path);
      if (response?.status() !== 200) continue;
      await page.evaluate(() => {
        for (const d of document.querySelectorAll("details")) d.open = true;
      });
      const [head, wide] = await page.evaluate(() => {
        const panel = document.querySelector("[data-comparison]");
        const tables = [...document.querySelectorAll("table.patch-table")];
        return [
          panel === null ? 0 : panel.scrollWidth - panel.clientWidth,
          tables.filter(
            (t) => t.scrollWidth > (t.parentElement?.clientWidth ?? 0) + 1,
          ).length,
        ];
      });
      expect(head, `${path}: the From/To panel overflows`).toBeLessThanOrEqual(
        0,
      );
      expect(wide, `${path}: tables wider than their fold`).toBe(0);
    }
    await context.close();
  });

  // ADR-054: a new entry says it is new, and still reads Before → After, with no before.
  test("a new ship is tagged New and opens on Before → After with an empty before", async ({
    page,
  }) => {
    await page.goto("/patches");
    const fresh = page.locator(
      '#ships details[data-patch-entry][data-status="added"]',
    );
    test.skip((await fresh.count()) === 0, "no new ship in this patch");
    const entry = fresh.first();
    // A new record of a ship that was there before reads "New variant" (ADR-054, amended).
    const tag = entry.locator("summary [data-entry-tag]");
    await expect(tag).toHaveText(/^New( variant)?$/);
    await entry.locator("summary").click();
    const note = entry.locator("[data-entry-note]");
    await expect(note).toContainText(/^New in /);
    if ((await tag.textContent()) === "New variant")
      await expect(note).toContainText("itself was in");
    const table = entry.locator("table").first();
    const heads = table.getByRole("columnheader");
    await expect(heads.filter({ hasText: "Before" })).toHaveCount(1);
    await expect(heads.filter({ hasText: "After" })).toHaveCount(1);
    await expect(heads.filter({ hasText: "Change" })).toHaveCount(0);
    // Every Before cell is the dash, read as "none".
    const before = await table.locator("td.old").allTextContents();
    expect(before.length).toBeGreaterThan(0);
    for (const cell of before) expect(cell).toContain("none");
  });

  test("an unknown patch is a 404", async ({ page }) => {
    const response = await page.goto("/patches/0.0.1");
    expect(response?.status()).toBe(404);
  });
});

// Spec 08's verification: an entry opened, at 390 px and 1280 px, light and dark.
const SHOTS = join(here, "__screenshots__");
for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`an opened entry at ${viewport.width} px, ${scheme}`, async ({
      browser,
    }) => {
      test.skip(previous === undefined, "two LIVE builds are needed");
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto("/patches");
      const entry = page.locator("#ships details[data-patch-entry]").last();
      await entry.locator("summary").click();
      await expect(entry.locator("table, dl").first()).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow, "page scrolls sideways").toBe(false);
      await entry.scrollIntoViewIfNeeded();
      mkdirSync(SHOTS, { recursive: true });
      await entry.screenshot({
        path: join(SHOTS, `patches-entry-open-${viewport.name}-${scheme}.png`),
      });
      await context.close();
    });
  }
}

// ADR-049, amended 2026-11-12: a version CIG has released on LIVE before the wiki publishes its
// figures leads the latest patch, and the footer's strip names it beside the build the figures
// are from. The release notes are Spectrum posts, so in CI (Spectrum off) neither shows; either
// way the page and the strip agree.
test("a version released ahead of its figures leads the latest patch, and the strip agrees", async ({
  page,
}) => {
  await page.goto("/patches");
  const released = page.locator("section#released");
  const strip = page.locator("footer dl");
  if ((await released.count()) === 0) {
    await expect(strip).not.toContainText("figures from");
    return;
  }
  const heading = released.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(/^\d+\.\d+\.\d+ is live$/);
  const version = (await heading.textContent())!.replace(" is live", "");
  await expect(strip).toContainText(`${version} · figures from`);
  await expect(
    page.getByRole("link", { name: `Latest ${version}` }),
  ).toBeVisible();
  // One line, not a list of every post that led to the release (the owner, 2026-11-13); the
  // comparison on record follows at once.
  await expect(released.locator("details")).toHaveCount(0);
  await expect(page.locator("[data-comparison]")).toHaveCount(1);
});
