import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "NEXT_PUBLIC_DEMO_MODE=true npm run dev",
    port: 3000,
    timeout: 60000,
    reuseExistingServer: true,
  },
});
