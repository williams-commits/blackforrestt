import { expect, test } from "@playwright/test";
import { expectNoCriticalAccessibilityViolations, login } from "./helpers";

const email = process.env.E2E_DEMO_EMAIL;
const password = process.env.E2E_DEMO_PASSWORD;

test.describe("customer workflows", () => {
  test.skip(!email || !password, "Set E2E_DEMO_EMAIL and E2E_DEMO_PASSWORD.");

  test("customer sees account integrity, finance, verification, and trading workflows", async ({ page }) => {
    await login(page, email!, password!, "/account");
    await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account integrity and reconciliation" })).toBeVisible();
    await page.getByRole("tab", { name: "Payments" }).click();
    await expect(page.getByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Verification" }).click();
    await expect(page.getByRole("heading", { name: "Verification checklist" })).toBeVisible();
    await page.getByRole("link", { name: "Trade" }).click();
    await expect(page).toHaveURL(/\/trade\/AUDCAD$/);
    await expect(page.getByText(/SIMULATION ONLY/)).toBeVisible();
    await expect(page.getByText(/Quote source:/)).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("trade terminal exposes lifecycle and open/closed views", async ({ page }) => {
    await login(page, email!, password!, "/trade/AUDCAD");
    await expect(page.getByText(/Order lifecycle:/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Open Positions/ })).toBeVisible();
    await page.getByRole("button", { name: "Trade History" }).click();
    await expect(page.getByText(/No trade history yet|Closed Time/)).toBeVisible();
  });


  test("chart keeps the selected timeframe after refresh and remains usable", async ({ page }) => {
    await login(page, email!, password!, "/trade/AUDCAD");
    const chartPanel = page.getByRole("button", { name: "Use 5m timeframe" });
    await chartPanel.click();
    await expect(page).toHaveURL(/\?tf=5m(?:&|$)/);
    await expect(chartPanel).toHaveAttribute("aria-pressed", "true");

    const chart = page.getByTestId("professional-chart-panel");
    const box = await chart.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(430);

    await page.reload();
    await expect(page.getByRole("button", { name: "Use 5m timeframe" })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\?tf=5m(?:&|$)/);
  });

  test("@mobile asset picker is scrollable and paginated", async ({ page }) => {
    await login(page, email!, password!, "/trade/AUDCAD?tf=5m");
    await page.getByRole("button", { name: "Change asset" }).click();
    await expect(page.getByRole("dialog", { name: "Assets" })).toBeVisible();

    const pagination = page.getByRole("navigation", { name: "instruments pagination" });
    await expect(pagination).toBeVisible();
    await expect(pagination.getByRole("button", { name: "Next" })).toBeEnabled();

    const scrollRegion = page.getByRole("dialog", { name: "Assets" }).locator(".overflow-y-auto").first();
    const metrics = await scrollRegion.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(metrics.overflowY).toBe("auto");
    expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight);

    await pagination.getByRole("button", { name: "Next" }).click();
    await expect(pagination).toContainText(/^2 \/ /);
  });

  test("authenticated users cannot return to login or registration", async ({ page }) => {
    await login(page, email!, password!, "/account");
    await page.goto("/login?callbackUrl=/trade/AUDCAD");
    await expect(page).toHaveURL(/\/account(?:[/?#]|$)/);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/account(?:[/?#]|$)/);
  });

  test("account shell passes critical accessibility checks", async ({ page }) => {
    await login(page, email!, password!, "/account");
    await expectNoCriticalAccessibilityViolations(page);
  });
});
