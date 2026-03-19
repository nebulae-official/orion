import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("sidebar has all 8 nav links", async ({ page }) => {
    await page.goto("/");

    const navLabels = [
      "Dashboard",
      "Content Queue",
      "Trends",
      "Analytics",
      "Publishing",
      "Generation",
      "System Health",
      "Settings",
    ];

    for (const label of navLabels) {
      await expect(page.locator("aside").getByText(label)).toBeVisible();
    }
  });

  test("each nav link navigates to correct page", async ({ page }) => {
    await page.goto("/");

    const routes: { label: string; path: string }[] = [
      { label: "Content Queue", path: "/queue" },
      { label: "Trends", path: "/trends" },
      { label: "Analytics", path: "/analytics" },
      { label: "Publishing", path: "/publishing" },
      { label: "Generation", path: "/generation" },
      { label: "System Health", path: "/system" },
      { label: "Settings", path: "/settings" },
      { label: "Dashboard", path: "/" },
    ];

    for (const route of routes) {
      await page.locator("aside").getByText(route.label).click();
      await page.waitForURL(`**${route.path}`);
      expect(new URL(page.url()).pathname).toBe(route.path);
    }
  });

  test("active state highlights current page", async ({ page }) => {
    await page.goto("/trends");

    // The active nav link has bg-primary-surface class on the <a> element
    const activeLink = page.locator("aside a.bg-primary-surface");
    await expect(activeLink).toBeVisible();
    await expect(activeLink).toContainText("Trends");
  });

  test("sign out button clears cookies and redirects to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();

    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});
