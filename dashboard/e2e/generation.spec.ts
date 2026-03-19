import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Generation Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page renders with title", async ({ page }) => {
    await page.goto("/generation");

    await expect(
      page.getByRole("heading", { name: "Generation Progress" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Real-time progress tracking for content generation pipelines."
      )
    ).toBeVisible();
  });

  test("generation progress section visible", async ({ page }) => {
    await page.goto("/generation");

    // In demo mode: pipeline cards with titles and "Live (Demo)" status.
    // In non-demo: "Reconnecting..." and "No active generations" messages.
    // Check that the page rendered its generation content section.
    const liveDemo = page.getByText("Live (Demo)");
    const reconnecting = page.getByText("Reconnecting...");

    await expect(liveDemo.or(reconnecting)).toBeVisible();
  });
});
