import { GATEWAY_URL } from "@/lib/config";

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ApiError {
  message: string;
  status: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GATEWAY_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    const error: ApiError = {
      message: body.message ?? body.detail ?? "Request failed",
      status: response.status,
    };
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

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
  options: RequestInit & { revalidate?: number } = {},
  token?: string
): Promise<T> {
  const url = `${GATEWAY_URL}${path}`;
  const { revalidate = 60, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    next: { revalidate },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message ?? body.detail ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
