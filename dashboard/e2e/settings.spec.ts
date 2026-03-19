import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("4 provider config cards", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("LLM (Text Generation)")).toBeVisible();
    await expect(page.getByText("Image Generation")).toBeVisible();
    await expect(page.getByText("Video Generation")).toBeVisible();
    await expect(page.getByText("Text-to-Speech")).toBeVisible();
  });

  test("Provider and Model dropdowns in each card", async ({ page }) => {
    await page.goto("/settings");

    // Each card has a Provider and Model label
    const providerLabels = page.getByText("Provider", { exact: true });
    const modelLabels = page.getByText("Model", { exact: true });

    expect(await providerLabels.count()).toBe(4);
    expect(await modelLabels.count()).toBe(4);
  });

  test("Save Configuration buttons", async ({ page }) => {
    await page.goto("/settings");

    const saveButtons = page.getByRole("button", {
      name: "Save Configuration",
    });
    expect(await saveButtons.count()).toBe(4);
  });

  test("provider status dots resolve from checking", async ({ page }) => {
    await page.goto("/settings");

    // Status dots start as "checking" then resolve to "connected" (demo) or "disconnected" (non-demo).
    // Wait for at least one status dot to be no longer "checking".
    const connectedDot = page.locator('span[title="connected"]').first();
    const disconnectedDot = page.locator('span[title="disconnected"]').first();

    await expect(connectedDot.or(disconnectedDot)).toBeVisible({
      timeout: 15000,
    });
  });
});
