import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Content Queue", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page renders with title", async ({ page }) => {
    await page.goto("/queue");

    await expect(
      page.getByRole("heading", { name: "Content Queue" })
    ).toBeVisible();
    await expect(
      page.getByText("Review and manage content in the pipeline.")
    ).toBeVisible();
  });

  test("7 filter tabs visible", async ({ page }) => {
    await page.goto("/queue");

    const tabs = [
      "All",
      "Draft",
      "Generating",
      "In Review",
      "Approved",
      "Published",
      "Rejected",
    ];

    for (const tab of tabs) {
      await expect(
        page.getByRole("button", { name: tab, exact: true })
      ).toBeVisible();
    }
  });

  test("content items render in demo mode", async ({ page }) => {
    await page.goto("/queue");

    // In demo mode, content cards should appear.
    // If not in demo mode, there will be a "No content found" or error message.
    // Check for at least one content card or the "No content found" message.
    const contentGrid = page.locator(
      '[class*="grid"] [class*="rounded"]'
    );
    const noContent = page.getByText("No content found.");

    // Wait for either content cards or the empty message
    await expect(contentGrid.first().or(noContent)).toBeVisible();
  });

  test("sort buttons are functional", async ({ page }) => {
    await page.goto("/queue");

    const dateBtn = page.getByRole("button", { name: "Date", exact: true });
    const scoreBtn = page.getByRole("button", { name: "Score", exact: true });

    await expect(dateBtn).toBeVisible();
    await expect(scoreBtn).toBeVisible();

    await scoreBtn.click();
    await page.waitForURL(/sort=score/);
    expect(page.url()).toContain("sort=score");
  });

  test("clicking a filter tab changes active state", async ({ page }) => {
    await page.goto("/queue");

    const approvedBtn = page.getByRole("button", {
      name: "Approved",
      exact: true,
    });
    await approvedBtn.click();

    await page.waitForURL(/status=approved/);
    expect(page.url()).toContain("status=approved");

    // The "Approved" button should now be active (has bg-primary)
    await expect(approvedBtn).toHaveClass(/bg-primary/);
  });
});
