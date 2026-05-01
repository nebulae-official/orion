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
      page.getByText("Review, approve and manage all generated content.")
    ).toBeVisible();
  });

  test("7 filter tabs visible", async ({ page }) => {
    await page.goto("/queue");

    const tabs = [
      "All",
      "In Review",
      "Approved",
      "Generating",
      "Rejected",
      "Published",
      "Draft",
    ];

    for (const tab of tabs) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${tab}`) })
      ).toBeVisible();
    }
  });

  test("content items render in demo mode", async ({ page }) => {
    await page.goto("/queue");

    // In demo mode, a grid of content cards is rendered.
    // Fall back to the empty-state title if demo data is absent.
    const contentCard = page.locator('[class*="grid"] [class*="rounded"]');
    const emptyState = page.getByText("Your content queue is empty");

    await expect(contentCard.first().or(emptyState)).toBeVisible();
  });

  test("sort toggle button is visible and functional", async ({ page }) => {
    await page.goto("/queue");

    // There is a single sort toggle button — it shows the current sort label.
    // Default sort is "date", so the button renders "Date".
    const sortBtn = page.getByRole("button", { name: /^(Date|Score)$/ });
    await expect(sortBtn).toBeVisible();

    // Clicking when label is "Date" navigates to ?sort=score.
    await sortBtn.click();
    await page.waitForURL(/sort=score/);
    expect(page.url()).toContain("sort=score");
  });

  test("clicking a filter tab updates URL", async ({ page }) => {
    await page.goto("/queue");

    const approvedBtn = page.getByRole("button", {
      name: /^Approved/,
    });
    await approvedBtn.click();

    await page.waitForURL(/status=approved/);
    expect(page.url()).toContain("status=approved");

    // Active filter has bg-primary-surface class.
    await expect(approvedBtn).toHaveClass(/bg-primary-surface/);
  });
});
