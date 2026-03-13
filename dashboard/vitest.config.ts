import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
