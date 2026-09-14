import { expect, test } from "@playwright/test";

const landingUrl = process.env.GBFXS_E2E_URL;

test.describe("GBFXS landing visual contract", () => {
  test.skip(!landingUrl, "Set GBFXS_E2E_URL to the GBFXS host before running this suite.");

  test("desktop keeps the enterprise header and canvas inside the viewport", async ({ page }) => {
    await page.goto(landingUrl!);
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(page.locator(".ag-shell")).toBeVisible();
    await expect(page.locator("h1.ag-display")).toBeVisible();
    await expect(page.locator("header nav")).toHaveCSS("height", "64px");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(1440);
  });

  test("mobile keeps navigation compact and prevents horizontal drift", async ({ page }) => {
    await page.goto(landingUrl!);
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.locator("header nav")).toHaveCSS("height", "64px");
    await expect(page.locator("header nav > div").first()).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
  });
});
