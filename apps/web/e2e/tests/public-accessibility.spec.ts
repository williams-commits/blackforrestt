import { expect, test } from "@playwright/test";
import { expectNoCriticalAccessibilityViolations } from "./helpers";

const publicPages = [
  // Default template hero (localhost resolves the primary brand).
  ["/", /Trade every market/i],
  ["/login", /Welcome back/i],
  ["/register", /Create/i],
  ["/forgot-password", /password/i],
  ["/about", /About/i],
  ["/contact", /Get in touch/i],
] as const;

for (const [path, heading] of publicPages) {
  test(`@public ${path} renders and passes critical accessibility checks`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expectNoCriticalAccessibilityViolations(page);
  });
}

test("@public login exposes labelled credentials and safe recovery navigation", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("@mobile mobile landing keeps primary calls to action reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open Free Account" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Launch Platform/ })).toBeVisible();
});

test("@mobile mobile navigation opens, scrolls, and closes", async ({ page }) => {
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await menuButton.click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Open Account" })).toBeVisible();
  await page.getByRole("button", { name: "Close navigation menu" }).click();
  await expect(mobileNav).toBeHidden();
});
