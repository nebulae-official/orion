import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test("renders login form with username, password, and sign in button", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByText("Welcome to Orion")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Username").fill("wrong");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.locator("text=failed").or(page.locator("text=Invalid").or(page.locator("text=error")))).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated access redirects to /login with redirect param", async ({
    page,
  }) => {
    await page.goto("/analytics");

    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fanalytics");
  });
});
