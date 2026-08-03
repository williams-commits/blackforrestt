import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string, destination = "/account") {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account(?:[/?#]|$)/);
  if (destination !== "/account") await page.goto(destination);
}

export async function expectNoCriticalAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
