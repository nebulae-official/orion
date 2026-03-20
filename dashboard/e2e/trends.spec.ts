import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Trends Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page renders with trend icon and title", async ({ page }) => {
    await page.goto("/trends");

    await expect(
      page.getByRole("heading", { name: "Trends" })
    ).toBeVisible();
    await expect(
      page.getByText("Discovered trends and their pipeline status.")
    ).toBeVisible();
  });

  test("3 stat cards visible", async ({ page }) => {
    await page.goto("/trends");

    await expect(page.getByText("Total Found")).toBeVisible();
    await expect(page.getByText("Used for Content")).toBeVisible();
    await expect(page.getByText("Discarded")).toBeVisible();
  });

  test("trend table renders", async ({ page }) => {
    await page.goto("/trends");

    // In demo mode, trend rows appear. In non-demo mode, a "No trends found" message shows.
    // The TrendTable component always renders; check for either data or empty state.
    const trendRow = page.locator("table tbody tr").first();
    const emptyMessage = page.getByText("No trends found");

    await expect(trendRow.or(emptyMessage)).toBeVisible();
  });
});
