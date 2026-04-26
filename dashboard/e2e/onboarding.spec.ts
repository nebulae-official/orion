import { test, expect, type Page } from "@playwright/test";

/**
 * Onboarding E2E tests for the Orion dashboard.
 *
 * IMPORTANT: The onboarding layout redirects to "/" when DEMO_MODE is true.
 * The default Playwright webServer starts with NEXT_PUBLIC_DEMO_MODE=true,
 * so these tests require the server to be started WITHOUT demo mode:
 *
 *   NEXT_PUBLIC_DEMO_MODE=false npx next dev -p 3002
 *
 * Then run:
 *   npx playwright test e2e/onboarding.spec.ts --reporter=list
 *
 * Alternatively, update playwright.config.ts with a second project that
 * sets NEXT_PUBLIC_DEMO_MODE=false.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake JWT with custom claims (no real signature needed). */
function createFakeJWT(claims: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = "fake-signature";
  return `${header}.${payload}.${signature}`;
}

/** Standard onboarding JWT with the `onboarding: true` claim. */
function onboardingToken(): string {
  return createFakeJWT({
    sub: "user-123",
    email: "test@example.com",
    role: "user",
    onboarding: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

/** Inject the onboarding cookies (token + user) into the browser context. */
async function injectOnboardingCookies(
  page: Page,
  opts?: { name?: string; email?: string; avatarUrl?: string | null }
): Promise<void> {
  const name = opts?.name ?? "Test User";
  const email = opts?.email ?? "test@example.com";
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  await page.context().addCookies([
    {
      name: "orion_token",
      value: onboardingToken(),
      domain: "localhost",
      path: "/",
    },
    {
      name: "orion_token_expiry",
      value: expiresAt,
      domain: "localhost",
      path: "/",
    },
    {
      name: "orion_user",
      value: JSON.stringify({
        id: "user-123",
        name,
        email,
        avatar_url: opts?.avatarUrl ?? null,
        role: "user",
      }),
      domain: "localhost",
      path: "/",
    },
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Onboarding — Guard behaviour", () => {
  test("redirects to / or /login without an onboarding JWT", async ({
    page,
  }) => {
    // Navigate to /onboarding with no cookies at all.
    await page.goto("/onboarding");

    // The layout should redirect away because there is no token.
    await page.waitForURL((url) => {
      const path = url.pathname;
      return path === "/" || path === "/login";
    });
  });

  test("dashboard redirects to /onboarding when JWT has onboarding claim", async ({
    page,
  }) => {
    await injectOnboardingCookies(page);

    // Navigating to the dashboard root should bounce us to /onboarding.
    await page.goto("/");
    await page.waitForURL(/\/onboarding/, { timeout: 10000 });
    expect(page.url()).toContain("/onboarding");
  });
});

test.describe("Onboarding — Page rendering", () => {
  test.beforeEach(async ({ page }) => {
    await injectOnboardingCookies(page);
    await page.goto("/onboarding");
    // Wait for the form to fully hydrate.
    await page.waitForSelector("#onboard-username", { timeout: 10000 });
  });

  test("renders the onboarding form with all expected fields", async ({
    page,
  }) => {
    // Title
    await expect(page.getByText("Complete Your Setup")).toBeVisible();

    // Pre-filled read-only fields
    await expect(page.locator("#onboard-name")).toHaveValue("Test User");
    await expect(page.locator("#onboard-email")).toHaveValue(
      "test@example.com"
    );
    await expect(page.locator("#onboard-name")).toBeDisabled();
    await expect(page.locator("#onboard-email")).toBeDisabled();

    // Editable fields
    await expect(page.locator("#onboard-username")).toBeVisible();
    await expect(page.locator("#onboard-password")).toBeVisible();
    await expect(page.locator("#onboard-confirm-password")).toBeVisible();
    await expect(page.locator("#onboard-first-name")).toBeVisible();
    await expect(page.locator("#onboard-last-name")).toBeVisible();
    await expect(page.locator("#onboard-timezone")).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: /complete setup/i })
    ).toBeVisible();
  });

  test("shows pre-filled first and last name from OAuth display name", async ({
    page,
  }) => {
    // "Test User" should be split into first="Test", last="User"
    await expect(page.locator("#onboard-first-name")).toHaveValue("Test");
    await expect(page.locator("#onboard-last-name")).toHaveValue("User");
  });

  test("displays initials avatar when no avatar_url is provided", async ({
    page,
  }) => {
    // The initials for "Test User" should be "TU"
    await expect(page.getByText("TU", { exact: true })).toBeVisible();
  });

  test("displays the user's name above the title", async ({ page }) => {
    await expect(page.getByText("Test User").first()).toBeVisible();
  });
});

test.describe("Onboarding — Username validation", () => {
  test.beforeEach(async ({ page }) => {
    await injectOnboardingCookies(page);
    await page.goto("/onboarding");
    await page.waitForSelector("#onboard-username", { timeout: 10000 });
  });

  test("rejects too-short username", async ({ page }) => {
    await page.locator("#onboard-username").fill("ab");

    // The hint text should indicate the format requirement.
    await expect(
      page.getByText(
        "3-30 characters, lowercase letters, numbers, and underscores only"
      )
    ).toBeVisible();
  });

  test("rejects invalid characters (normalises to lowercase alphanumeric + underscore)", async ({
    page,
  }) => {
    // The form handler strips invalid characters and lowercases,
    // so typing "AB!" becomes "ab" which is too short — triggering the hint.
    await page.locator("#onboard-username").pressSequentially("AB!", {
      delay: 50,
    });

    await expect(
      page.getByText(
        "3-30 characters, lowercase letters, numbers, and underscores only"
      )
    ).toBeVisible();
  });

  test("accepts a valid username format", async ({ page }) => {
    await page.locator("#onboard-username").fill("test_user_123");

    // When the username is valid the hint should say "Choose a unique username"
    // or show the availability indicator (checking/available/taken).
    // The format error message should NOT be visible.
    await expect(
      page.getByText(
        "3-30 characters, lowercase letters, numbers, and underscores only"
      )
    ).not.toBeVisible();
  });
});

test.describe("Onboarding — Password validation", () => {
  test.beforeEach(async ({ page }) => {
    await injectOnboardingCookies(page);
    await page.goto("/onboarding");
    await page.waitForSelector("#onboard-password", { timeout: 10000 });
  });

  test("shows minimum length error for short password", async ({ page }) => {
    await page.locator("#onboard-password").fill("short");

    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();
  });

  test("no error for valid-length password", async ({ page }) => {
    await page.locator("#onboard-password").fill("validpass123");

    await expect(
      page.getByText("Password must be at least 8 characters")
    ).not.toBeVisible();
  });

  test("shows mismatch error when passwords differ", async ({ page }) => {
    await page.locator("#onboard-password").fill("password123");
    await page.locator("#onboard-confirm-password").fill("different123");

    await expect(
      page.getByText("Passwords do not match")
    ).toBeVisible();
  });

  test("no mismatch error when passwords match", async ({ page }) => {
    await page.locator("#onboard-password").fill("password123");
    await page.locator("#onboard-confirm-password").fill("password123");

    await expect(
      page.getByText("Passwords do not match")
    ).not.toBeVisible();
  });
});

test.describe("Onboarding — Form submission guards", () => {
  test.beforeEach(async ({ page }) => {
    await injectOnboardingCookies(page);
    await page.goto("/onboarding");
    await page.waitForSelector("#onboard-username", { timeout: 10000 });
  });

  test("submit button is disabled when required fields are empty", async ({
    page,
  }) => {
    const submitButton = page.getByRole("button", {
      name: /complete setup/i,
    });

    // With all fields empty, the button should be disabled.
    await expect(submitButton).toBeDisabled();
  });

  test("submit button remains disabled with only username filled", async ({
    page,
  }) => {
    await page.locator("#onboard-username").fill("valid_user");

    const submitButton = page.getByRole("button", {
      name: /complete setup/i,
    });
    await expect(submitButton).toBeDisabled();
  });

  test("submit button remains disabled when passwords do not match", async ({
    page,
  }) => {
    await page.locator("#onboard-username").fill("valid_user");
    await page.locator("#onboard-password").fill("password123");
    await page.locator("#onboard-confirm-password").fill("different123");

    const submitButton = page.getByRole("button", {
      name: /complete setup/i,
    });
    await expect(submitButton).toBeDisabled();
  });
});

test.describe("Onboarding — Visual verification", () => {
  test("takes screenshot of onboarding page", async ({ page }) => {
    await injectOnboardingCookies(page);
    await page.goto("/onboarding");
    await page.waitForSelector("#onboard-username", { timeout: 10000 });

    await page.screenshot({
      path: "e2e/screenshots/onboarding.png",
      fullPage: true,
    });
  });
});
