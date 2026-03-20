import { describe, it, expect, vi } from "vitest";

// We need to mock next/server before importing middleware
vi.mock("next/server", () => {
  class MockNextResponse {
    static redirect(url: URL): { type: string; url: string; cookies: { delete: ReturnType<typeof vi.fn> } } {
      return {
        type: "redirect",
        url: url.toString(),
        cookies: { delete: vi.fn() },
      };
    }
    static next(): { type: string } {
      return { type: "next" };
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

import { middleware } from "@/middleware";

function createMockRequest(
  pathname: string,
  cookies: Record<string, string> = {}
): Parameters<typeof middleware>[0] {
  return {
    nextUrl: {
      pathname,
    },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: (name: string) => {
        const value = cookies[name];
        return value ? { value } : undefined;
      },
    },
  } as unknown as Parameters<typeof middleware>[0];
}

describe("middleware", () => {
  it("allows access to /login for unauthenticated users", () => {
    const request = createMockRequest("/login");
    const response = middleware(request);

    expect(response).toHaveProperty("type", "next");
  });

  it("redirects authenticated users from /login to /", () => {
    const request = createMockRequest("/login", {
      orion_token: "valid-token",
    });
    const response = middleware(request);

    expect(response).toHaveProperty("type", "redirect");
    expect(response).toHaveProperty("url", expect.stringContaining("/"));
  });

  it("allows Next.js internal paths", () => {
    const request = createMockRequest("/_next/static/chunk.js");
    const response = middleware(request);

    expect(response).toHaveProperty("type", "next");
  });

  it("allows paths with file extensions", () => {
    const request = createMockRequest("/favicon.ico");
    const response = middleware(request);

    expect(response).toHaveProperty("type", "next");
  });

  it("redirects unauthenticated users to /login", () => {
    const request = createMockRequest("/queue");
    const response = middleware(request);

    expect(response).toHaveProperty("type", "redirect");
    expect(response).toHaveProperty(
      "url",
      expect.stringContaining("/login")
    );
  });

  it("includes redirect param when redirecting to login", () => {
    const request = createMockRequest("/queue");
    const response = middleware(request);

    expect(response).toHaveProperty(
      "url",
      expect.stringContaining("redirect=%2Fqueue")
    );
  });

  it("allows authenticated users with valid token", () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const request = createMockRequest("/queue", {
      orion_token: "valid-token",
      orion_token_expiry: futureDate,
    });
    const response = middleware(request);

    expect(response).toHaveProperty("type", "next");
  });

  it("redirects users with expired tokens", () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const request = createMockRequest("/queue", {
      orion_token: "expired-token",
      orion_token_expiry: pastDate,
    });
    const response = middleware(request);

    expect(response).toHaveProperty("type", "redirect");
    expect(response).toHaveProperty(
      "url",
      expect.stringContaining("/login")
    );
  });
});
