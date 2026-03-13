import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { serverFetch } from "@/lib/api-client";

describe("serverFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("constructs the correct URL", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: "test" }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

    await serverFetch("/api/v1/test");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("includes authorization header when token provided", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: "test" }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

    await serverFetch("/api/v1/test", {}, "my-token");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
        }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ message: "Server error" }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(serverFetch("/api/v1/test")).rejects.toThrow("Server error");
  });

  it("handles 204 no content", async () => {
    const mockResponse = {
      ok: true,
      status: 204,
      json: vi.fn(),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await serverFetch("/api/v1/test");
    expect(result).toBeUndefined();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it("uses default revalidation of 60 seconds", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

    await serverFetch("/api/v1/test");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        next: { revalidate: 60 },
      })
    );
  });

  it("allows overriding revalidation", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

    await serverFetch("/api/v1/test", { revalidate: 30 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        next: { revalidate: 30 },
      })
    );
  });
});
