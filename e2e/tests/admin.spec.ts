import { expect, test } from "@playwright/test";
import { expectNoCriticalAccessibilityViolations, login } from "./helpers";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("administrator workflows", () => {
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.");

  test("administrator sees role-aware modules and reconciliation operations", async ({ page }) => {
    await login(page, email!, password!, "/admin");
    await expect(page.getByRole("heading", { name: "Enterprise operations console" })).toBeVisible();
    await expect(page.getByLabel("Active administrative roles")).toContainText(/SUPER ADMIN|FINANCE|RISK|AUDITOR/);
    await page.getByRole("button", { name: "Reconciliation" }).click();
    await expect(page.getByRole("heading", { name: "Reconciliation operations" })).toBeVisible();
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("heading", { name: /Active blocks/ })).toBeVisible();
  });

  test("administrator can inspect audit and maker-checker modules", async ({ page }) => {
    await login(page, email!, password!, "/admin");
    await page.getByRole("button", { name: "Audit" }).click();
    await expect(page.getByRole("heading", { name: "Immutable audit trail" })).toBeVisible();
    await page.getByRole("button", { name: "Approvals" }).click();
    await expect(page.getByRole("heading", { name: "Maker-checker approvals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for approval" })).toBeVisible();
  });

  test("administrator console passes critical accessibility checks", async ({ page }) => {
    await login(page, email!, password!, "/admin");
    await expectNoCriticalAccessibilityViolations(page);
  });
});
