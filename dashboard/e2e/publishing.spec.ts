import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Publishing Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page renders with title and subtitle", async ({ page }) => {
    await page.goto("/publishing");

    await expect(
      page.getByRole("heading", { name: "Publishing" })
    ).toBeVisible();
    await expect(
      page.getByText("Platform connections, publish history and scheduled posts.")
    ).toBeVisible();
  });

  test("platform summary cards render", async ({ page }) => {
    await page.goto("/publishing");

    // Four platform tiles must always be present. exact: true avoids matching
    // "YouTube" inside the history table's platform badge spans ("▶YouTube").
    for (const label of ["Twitter / X", "YouTube", "TikTok", "LinkedIn"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("publish history table or empty state visible", async ({ page }) => {
    await page.goto("/publishing");

    // In demo mode: a table with "Publish History" heading.
    // In non-demo mode: EmptyState with "Nothing published yet".
    const historyHeading = page.getByRole("heading", { name: "Publish History" });
    const emptyState = page.getByText("Nothing published yet");

    await expect(historyHeading.or(emptyState)).toBeVisible();
  });

  test("publish history table columns visible in demo mode", async ({ page }) => {
    await page.goto("/publishing");

    // Demo mode renders the table — verify column headers exist.
    const historyHeading = page.getByRole("heading", { name: "Publish History" });
    const emptyState = page.getByText("Nothing published yet");
    const hasRecords = await historyHeading.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (!hasRecords && !isEmpty) {
      // wait for one or the other
      await expect(historyHeading.or(emptyState)).toBeVisible({ timeout: 10000 });
    }

    if (hasRecords) {
      for (const col of ["Content", "Platform", "Status", "Published", "Cost"]) {
        await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
      }
      // Export CSV ghost button
      await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
    }
  });
});
