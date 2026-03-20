import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("System Health Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("Service Status section with all 6 services listed", async ({
    page,
  }) => {
    await page.goto("/system");

    await expect(
      page.getByRole("heading", { name: "Service Status" })
    ).toBeVisible();

    const services = [
      "Gateway",
      "Scout (Trends)",
      "Director (Scripts)",
      "Media (Assets)",
      "Editor (Publish)",
      "Pulse (Analytics)",
    ];

    for (const service of services) {
      await expect(page.getByText(service)).toBeVisible();
    }
  });

  test("GPU Status section present", async ({ page }) => {
    await page.goto("/system");

    await expect(
      page.getByRole("heading", { name: "GPU Status" })
    ).toBeVisible();

    // GPU gauge loads asynchronously. Wait for either VRAM data or error state.
    const vramUsed = page.getByText("VRAM Used");
    const gpuError = page.getByText("GPU info unavailable");
    const gpuMonitoring = page.getByText("GPU monitoring requires");

    await expect(
      vramUsed.or(gpuError).or(gpuMonitoring)
    ).toBeVisible({ timeout: 10000 });
  });

  test("refresh buttons present", async ({ page }) => {
    await page.goto("/system");

    // There should be refresh buttons (title="Refresh now" and title="Refresh")
    const refreshButtons = page.locator(
      'button[title="Refresh now"], button[title="Refresh"]'
    );
    await expect(refreshButtons.first()).toBeVisible();
    expect(await refreshButtons.count()).toBeGreaterThanOrEqual(2);
  });
});
