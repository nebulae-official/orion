const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000";

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ApiErrorResponse {
  message: string;
  status: number;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)orion_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GATEWAY_URL}${path}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(body.message ?? body.detail ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    // No content — return null cast through unknown for type safety
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Client-side API helper for **unauthenticated** endpoints only.
 *
 * The gateway expects Bearer tokens for authentication, but the JWT is stored
 * in an httpOnly cookie that cannot be read by client-side JavaScript.
 * For authenticated requests, use server actions (`src/lib/actions.ts`) instead.
 */
export const apiClient = {
  get<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: "GET" });
  },

  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: "DELETE" });
  },
};

/**
 * Server-side fetch wrapper that reads the token from cookies.
 * Use in Server Components and Server Actions.
 */
export async function serverFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${GATEWAY_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message ?? body.detail ?? "Request failed");
  }

  if (response.status === 204) {
    // No content — return null cast through unknown for type safety
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}
