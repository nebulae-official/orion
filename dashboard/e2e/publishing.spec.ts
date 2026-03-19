import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Publishing Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page renders with title", async ({ page }) => {
    await page.goto("/publishing");

    await expect(
      page.getByRole("heading", { name: "Publishing History" })
    ).toBeVisible();
  });

  test("publishing records or empty state visible", async ({ page }) => {
    await page.goto("/publishing");

    // In demo mode: a table with records. In non-demo mode: "No publishing records yet".
    const table = page.locator("table");
    const emptyState = page.getByText("No publishing records yet");

    await expect(table.or(emptyState)).toBeVisible();
  });
});
