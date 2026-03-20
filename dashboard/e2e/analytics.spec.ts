import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Analytics Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("KPI cards render", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page.getByText("Total Generated")).toBeVisible();
    await expect(page.getByText("Approval Rate")).toBeVisible();
    await expect(page.getByText("Total Cost")).toBeVisible();
  });

  test("Content Pipeline chart container present", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page.getByText("Content Pipeline")).toBeVisible();
  });

  test("Cost by Provider section present", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page.getByText("Cost by Provider")).toBeVisible();
  });

  test("Provider Usage section present", async ({ page }) => {
    await page.goto("/analytics");

    // Use exact heading match to avoid matching the subtitle
    await expect(
      page.locator("h3", { hasText: "Provider Usage" })
    ).toBeVisible();
  });

  test("Error Trends section present", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page.getByText("Error Trends (last 7 days)")).toBeVisible();
  });
});
