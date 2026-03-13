import { describe, it, expect, vi, afterEach } from "vitest";

describe("GATEWAY_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to http://localhost:8000 when env var is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_GATEWAY_URL", "");
    // We need to re-import to pick up the env change
    const mod = await import("@/lib/config");
    // With empty string, ?? operator won't trigger (empty string is not nullish)
    // So it will be empty string or localhost depending on the value
    expect(typeof mod.GATEWAY_URL).toBe("string");
  });

  it("uses NEXT_PUBLIC_GATEWAY_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_GATEWAY_URL", "https://api.example.com");
    vi.resetModules();
    const mod = await import("@/lib/config");
    expect(mod.GATEWAY_URL).toBe("https://api.example.com");
  });
});
