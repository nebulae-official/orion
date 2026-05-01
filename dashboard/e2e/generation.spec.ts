import { test, expect } from "@playwright/test";
import { injectAuthCookies } from "./helpers";

test.describe("Generation Page", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
  });

  test("page renders with title", async ({ page }) => {
    await page.goto("/generation");

    // /generation redirects to /generation/pipeline; layout renders the heading.
    await expect(
      page.getByRole("heading", { name: "Generation" })
    ).toBeVisible();
    await expect(
      page.getByText("Live pipeline - agent swarm status and job tracking.")
    ).toBeVisible();
  });

  test("KPI summary cards visible", async ({ page }) => {
    await page.goto("/generation/pipeline");

    // Four KPI cards are always rendered when content exists in demo mode.
    await expect(page.getByText("Pending / Queued")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Completed")).toBeVisible();
    await expect(page.getByText("Failed")).toBeVisible();
  });

  test("agent status panel visible in demo mode", async ({ page }) => {
    await page.goto("/generation/pipeline");

    // Demo data always has content → agent swarm card is rendered.
    await expect(page.getByText("Agent Status")).toBeVisible();

    // All five agents must appear (exact match avoids hitting nav tab "Media Assets").
    for (const name of ["Scout", "Director", "Media", "Editor", "Publisher"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test("workflow cards table visible", async ({ page }) => {
    await page.goto("/generation/pipeline");

    // "Workflow Cards" is a GenerationSectionHeading above the table.
    await expect(page.getByText("Workflow Cards")).toBeVisible();

    // Table columns
    for (const col of ["Title", "Pipeline Stage", "Current Stage", "Status"]) {
      await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
    }
  });

  test("pipeline timeline sidebar visible", async ({ page }) => {
    await page.goto("/generation/pipeline");

    await expect(page.getByText("Pipeline Timeline")).toBeVisible();
  });

  test("status filter links render", async ({ page }) => {
    await page.goto("/generation/pipeline");

    for (const label of ["All Statuses", "Draft", "Generating", "Review", "Approved"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });
});
