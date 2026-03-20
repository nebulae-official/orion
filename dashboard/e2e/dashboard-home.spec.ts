import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Dashboard Home", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page title and welcome message", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByText("Welcome to the Orion Content Agency dashboard.")
    ).toBeVisible();
  });

  test("4 quick-access cards render", async ({ page }) => {
    await page.goto("/");

    const cards = [
      { title: "Content Queue", description: "Review pending content" },
      { title: "Trends", description: "View detected trends" },
      { title: "Approved", description: "Content ready to publish" },
      { title: "In Review", description: "Content awaiting review" },
    ];

    for (const card of cards) {
      await expect(page.getByText(card.title).first()).toBeVisible();
      await expect(page.getByText(card.description)).toBeVisible();
    }
  });

  test("cards link to correct pages", async ({ page }) => {
    await page.goto("/");

    // Click Content Queue card
    await page.getByText("Review pending content").click();
    await page.waitForURL("**/queue");
    expect(new URL(page.url()).pathname).toBe("/queue");

    // Go back and click Trends card
    await page.goto("/");
    await page.getByText("View detected trends").click();
    await page.waitForURL("**/trends");
    expect(new URL(page.url()).pathname).toBe("/trends");
  });
});
