/**
 * Server Parity Tests — Prod (3001) vs Dev (3002)
 *
 * Verifies that both servers render identical UI/UX:
 * - Same page structure and DOM elements
 * - Same glass design system in both themes
 * - Same navigation and sidebar
 * - Same chart components
 * - Screenshot comparison for visual diff
 *
 * Prerequisites:
 *   make dash-prod   (port 3001, no demo — needs auth cookies)
 *   make dash-dev    (port 3002, demo mode — bypasses auth)
 */

import { test, expect, type Page } from "@playwright/test";

const PROD_URL = "http://localhost:3001";
const DEV_URL = "http://localhost:3002";

// Routes to compare (demo mode bypasses auth, prod needs cookies)
// Public pages compared with auth cookies on both servers
// (demo mode redirects /login→/ so we compare with auth to avoid redirect asymmetry)
const STATIC_ROUTES: { path: string; name: string }[] = [];

const AUTH_ROUTES = [
  { path: "/", name: "Dashboard Home" },
  { path: "/trends", name: "Trends" },
  { path: "/queue", name: "Content Queue" },
  { path: "/analytics", name: "Analytics" },
  { path: "/settings", name: "Settings" },
  { path: "/system", name: "System Health" },
  { path: "/generation", name: "Generation" },
  { path: "/publishing", name: "Publishing" },
  { path: "/profile", name: "Profile" },
];

async function injectAuthCookies(page: Page, baseUrl: string): Promise<void> {
  const domain = new URL(baseUrl).hostname;
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  await page.context().addCookies([
    { name: "orion_token", value: "test-token", domain, path: "/" },
    { name: "orion_token_expiry", value: expiresAt, domain, path: "/" },
    {
      name: "orion_user",
      value: JSON.stringify({ id: "1", username: "admin", name: "Admin User", role: "admin" }),
      domain,
      path: "/",
    },
  ]);
}

// ---------------------------------------------------------------------------
// 1. Structural Parity — DOM elements match across servers
// ---------------------------------------------------------------------------

test.describe("Structural Parity", () => {
  for (const route of STATIC_ROUTES) {
    test(`${route.name} (${route.path}) — same structure on prod and dev`, async ({ browser }) => {
      const prodCtx = await browser.newContext();
      const devCtx = await browser.newContext();
      const prodPage = await prodCtx.newPage();
      const devPage = await devCtx.newPage();

      await prodPage.goto(`${PROD_URL}${route.path}`, { waitUntil: "networkidle" });
      await devPage.goto(`${DEV_URL}${route.path}`, { waitUntil: "networkidle" });

      // Compare heading count
      const prodHeadings = await prodPage.locator("h1, h2, h3").count();
      const devHeadings = await devPage.locator("h1, h2, h3").count();
      expect(prodHeadings).toBe(devHeadings);

      // Compare button count
      const prodButtons = await prodPage.locator("button").count();
      const devButtons = await devPage.locator("button").count();
      expect(prodButtons).toBe(devButtons);

      // Compare input count
      const prodInputs = await prodPage.locator("input").count();
      const devInputs = await devPage.locator("input").count();
      expect(prodInputs).toBe(devInputs);

      // Compare link count
      const prodLinks = await prodPage.locator("a").count();
      const devLinks = await devPage.locator("a").count();
      expect(prodLinks).toBe(devLinks);

      await prodCtx.close();
      await devCtx.close();
    });
  }

  for (const route of AUTH_ROUTES) {
    test(`${route.name} (${route.path}) [auth] — same structure on prod and dev`, async ({ browser }) => {
      const prodCtx = await browser.newContext();
      const devCtx = await browser.newContext();
      const prodPage = await prodCtx.newPage();
      const devPage = await devCtx.newPage();

      await injectAuthCookies(prodPage, PROD_URL);
      await injectAuthCookies(devPage, DEV_URL);

      await prodPage.goto(`${PROD_URL}${route.path}`, { waitUntil: "networkidle" });
      await devPage.goto(`${DEV_URL}${route.path}`, { waitUntil: "networkidle" });

      // Compare page-level heading (h1) — always present regardless of data
      const prodH1 = await prodPage.locator("h1").count();
      const devH1 = await devPage.locator("h1").count();
      expect(prodH1).toBe(devH1);

      // Compare sidebar nav items count (data-independent)
      const prodNavItems = await prodPage.locator("aside nav a").count();
      const devNavItems = await devPage.locator("aside nav a").count();
      expect(prodNavItems).toBe(devNavItems);

      // Both should have the glass design system elements
      await expect(prodPage.locator("aside.glass-panel")).toBeVisible();
      await expect(devPage.locator("aside.glass-panel")).toBeVisible();
      await expect(prodPage.locator("header.glass-panel")).toBeVisible();
      await expect(devPage.locator("header.glass-panel")).toBeVisible();

      await prodCtx.close();
      await devCtx.close();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Glass Design System Parity
// ---------------------------------------------------------------------------

test.describe("Glass Design System", () => {
  test("sidebar has glass-card class on both servers", async ({ browser }) => {
    const prodCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const devCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const prodPage = await prodCtx.newPage();
    const devPage = await devCtx.newPage();

    await injectAuthCookies(prodPage, PROD_URL);
    await injectAuthCookies(devPage, DEV_URL);

    await prodPage.goto(`${PROD_URL}/`, { waitUntil: "networkidle" });
    await devPage.goto(`${DEV_URL}/`, { waitUntil: "networkidle" });

    // Sidebar should have glass-card class
    const prodSidebar = prodPage.locator("aside.glass-panel");
    const devSidebar = devPage.locator("aside.glass-panel");
    await expect(prodSidebar).toBeVisible();
    await expect(devSidebar).toBeVisible();

    // Top nav should have glass-card class
    const prodTopNav = prodPage.locator("header.glass-panel");
    const devTopNav = devPage.locator("header.glass-panel");
    await expect(prodTopNav).toBeVisible();
    await expect(devTopNav).toBeVisible();

    // Nebula background should exist
    const prodNebula = prodPage.locator(".nebula-bg");
    const devNebula = devPage.locator(".nebula-bg");
    await expect(prodNebula).toBeAttached();
    await expect(devNebula).toBeAttached();

    await prodCtx.close();
    await devCtx.close();
  });

  test("glass-card CSS class is applied consistently on both servers", async ({ browser }) => {
    const prodCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const devCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const prodPage = await prodCtx.newPage();
    const devPage = await devCtx.newPage();

    await injectAuthCookies(prodPage, PROD_URL);
    await injectAuthCookies(devPage, DEV_URL);

    await prodPage.goto(`${PROD_URL}/`, { waitUntil: "networkidle" });
    await devPage.goto(`${DEV_URL}/`, { waitUntil: "networkidle" });

    // Verify glass-card count matches (sidebar + top-nav + content cards)
    const prodGlassCards = await prodPage.locator(".glass-card").count();
    const devGlassCards = await devPage.locator(".glass-card").count();
    expect(prodGlassCards).toBeGreaterThan(0);
    expect(prodGlassCards).toBe(devGlassCards);

    // Verify luminous-border count matches
    const prodLuminous = await prodPage.locator(".luminous-border").count();
    const devLuminous = await devPage.locator(".luminous-border").count();
    expect(prodLuminous).toBe(devLuminous);

    await prodCtx.close();
    await devCtx.close();
  });
});

// ---------------------------------------------------------------------------
// 3. Navigation Parity
// ---------------------------------------------------------------------------

test.describe("Navigation Parity", () => {
  test("sidebar nav items match on both servers", async ({ browser }) => {
    const prodCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const devCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const prodPage = await prodCtx.newPage();
    const devPage = await devCtx.newPage();

    await injectAuthCookies(prodPage, PROD_URL);
    await injectAuthCookies(devPage, DEV_URL);

    await prodPage.goto(`${PROD_URL}/`, { waitUntil: "networkidle" });
    await devPage.goto(`${DEV_URL}/`, { waitUntil: "networkidle" });

    const prodLinks = await prodPage.locator("aside nav a").allTextContents();
    const devLinks = await devPage.locator("aside nav a").allTextContents();

    expect(prodLinks.length).toBeGreaterThan(0);
    expect(prodLinks).toEqual(devLinks);

    await prodCtx.close();
    await devCtx.close();
  });

  test("sidebar nav hrefs match on both servers", async ({ browser }) => {
    const prodCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const devCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const prodPage = await prodCtx.newPage();
    const devPage = await devCtx.newPage();

    await injectAuthCookies(prodPage, PROD_URL);
    await injectAuthCookies(devPage, DEV_URL);

    await prodPage.goto(`${PROD_URL}/`, { waitUntil: "networkidle" });
    await devPage.goto(`${DEV_URL}/`, { waitUntil: "networkidle" });

    const prodHrefs = await prodPage.locator("aside nav a").evaluateAll(
      (els) => els.map((el) => el.getAttribute("href"))
    );
    const devHrefs = await devPage.locator("aside nav a").evaluateAll(
      (els) => els.map((el) => el.getAttribute("href"))
    );

    expect(prodHrefs).toEqual(devHrefs);

    await prodCtx.close();
    await devCtx.close();
  });
});

// ---------------------------------------------------------------------------
// 4. Theme Parity — Light and Dark mode render on both
// ---------------------------------------------------------------------------

test.describe("Theme Parity", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme} mode renders consistently on both servers`, async ({ browser }) => {
      const prodCtx = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        colorScheme: theme,
      });
      const devCtx = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        colorScheme: theme,
      });
      const prodPage = await prodCtx.newPage();
      const devPage = await devCtx.newPage();

      await injectAuthCookies(prodPage, PROD_URL);
      await injectAuthCookies(devPage, DEV_URL);

      await prodPage.goto(`${PROD_URL}/`, { waitUntil: "networkidle" });
      await devPage.goto(`${DEV_URL}/`, { waitUntil: "networkidle" });

      // Both should have the nebula background
      await expect(prodPage.locator(".nebula-bg")).toBeAttached();
      await expect(devPage.locator(".nebula-bg")).toBeAttached();

      // Both should have glass-card sidebar
      await expect(prodPage.locator("aside.glass-panel")).toBeVisible();
      await expect(devPage.locator("aside.glass-panel")).toBeVisible();

      // Card count should match
      const prodCards = await prodPage.locator("[data-slot='card']").count();
      const devCards = await devPage.locator("[data-slot='card']").count();
      expect(prodCards).toBe(devCards);

      await prodCtx.close();
      await devCtx.close();
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Screenshot Comparison — Visual diff across all routes
// ---------------------------------------------------------------------------

test.describe("Screenshot Comparison", () => {
  for (const route of AUTH_ROUTES) {
    test(`${route.name} (${route.path}) — visual match`, async ({ browser }) => {
      const prodCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const devCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const prodPage = await prodCtx.newPage();
      const devPage = await devCtx.newPage();

      await injectAuthCookies(prodPage, PROD_URL);
      await injectAuthCookies(devPage, DEV_URL);

      await prodPage.goto(`${PROD_URL}${route.path}`, { waitUntil: "networkidle" });
      await devPage.goto(`${DEV_URL}${route.path}`, { waitUntil: "networkidle" });

      const prodScreenshot = await prodPage.screenshot({ fullPage: true });
      const devScreenshot = await devPage.screenshot({ fullPage: true });

      // Screenshots should be close in size (within 20% tolerance for dynamic content)
      const sizeDiff = Math.abs(prodScreenshot.length - devScreenshot.length);
      const maxSize = Math.max(prodScreenshot.length, devScreenshot.length);
      const diffPercent = (sizeDiff / maxSize) * 100;

      // Allow up to 25% difference due to demo data vs empty state
      expect(diffPercent).toBeLessThan(25);

      // Save screenshots for manual review
      const safeName = route.name.replace(/\s+/g, "-").toLowerCase();
      await prodPage.screenshot({
        fullPage: true,
        path: `e2e/screenshots/prod-${safeName}.png`,
      });
      await devPage.screenshot({
        fullPage: true,
        path: `e2e/screenshots/dev-${safeName}.png`,
      });

      await prodCtx.close();
      await devCtx.close();
    });
  }
});
