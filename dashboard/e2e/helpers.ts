import { Page } from "@playwright/test";

export async function injectAuthCookies(page: Page): Promise<void> {
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  await page.context().addCookies([
    { name: "orion_token", value: "test-token", domain: "localhost", path: "/" },
    { name: "orion_token_expiry", value: expiresAt, domain: "localhost", path: "/" },
    {
      name: "orion_user",
      value: JSON.stringify({ id: "1", username: "admin", role: "admin" }),
      domain: "localhost",
      path: "/",
    },
  ]);
}
