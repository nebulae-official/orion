"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthResponse, User } from "@/types/api";
import { SERVER_GATEWAY_URL } from "@/lib/config";

const TOKEN_COOKIE = "orion_token";
const REFRESH_TOKEN_COOKIE = "orion_refresh_token";
const TOKEN_EXPIRY_COOKIE = "orion_token_expiry";
const USER_COOKIE = "orion_user";

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SERVER_GATEWAY_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Login failed" }));
      return { success: false, error: body.message ?? body.detail ?? "Invalid credentials" };
    }

    const data: AuthResponse = await response.json();
    const cookieStore = await cookies();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    cookieStore.set(TOKEN_COOKIE, data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    cookieStore.set(TOKEN_EXPIRY_COOKIE, expiresAt.toISOString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    cookieStore.set(USER_COOKIE, JSON.stringify(data.user), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    if (data.refresh_token) {
      // Refresh tokens have a longer lifetime (30 days)
      const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      cookieStore.set(REFRESH_TOKEN_COOKIE, data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: refreshExpiry,
      });
    }

    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const accessToken = cookieStore.get(TOKEN_COOKIE)?.value;

  // Call gateway logout to invalidate server-side session
  try {
    await fetch(`${SERVER_GATEWAY_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken ?? "" }),
    });
  } catch {
    // Best-effort — clear cookies regardless
  }

  cookieStore.delete(TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(TOKEN_EXPIRY_COOKIE);
  cookieStore.delete(USER_COOKIE);
  redirect("/login");
}

export async function getSession(): Promise<{
  token: string | null;
  user: User | null;
  isExpired: boolean;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value ?? null;
  const expiryStr = cookieStore.get(TOKEN_EXPIRY_COOKIE)?.value ?? null;
  const userStr = cookieStore.get(USER_COOKIE)?.value ?? null;

  const user = userStr ? (JSON.parse(userStr) as User) : null;
  const isExpired = expiryStr ? new Date(expiryStr) <= new Date() : true;

  return { token, user, isExpired };
}

export async function getAuthToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.token || session.isExpired) return null;
  return session.token;
}

export async function refreshTokenIfNeeded(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const expiryStr = cookieStore.get(TOKEN_EXPIRY_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!token || !expiryStr) return null;

  const expiry = new Date(expiryStr);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  // Refresh if token expires in less than 5 minutes
  if (expiry.getTime() - now.getTime() > fiveMinutes) {
    return token;
  }

  try {
    const response = await fetch(`${SERVER_GATEWAY_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken ?? "" }),
    });

    if (!response.ok) return null;

    const data: AuthResponse = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    cookieStore.set(TOKEN_COOKIE, data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    cookieStore.set(TOKEN_EXPIRY_COOKIE, expiresAt.toISOString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    if (data.refresh_token) {
      const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      cookieStore.set(REFRESH_TOKEN_COOKIE, data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: refreshExpiry,
      });
    }

    if (data.user) {
      cookieStore.set(USER_COOKIE, JSON.stringify(data.user), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      });
    }

    return data.access_token;
  } catch {
    return null;
  }
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SERVER_GATEWAY_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Registration failed" }));
      return { success: false, error: body.message ?? body.detail ?? "Registration failed" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function forgotPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SERVER_GATEWAY_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Request failed" }));
      return { success: false, error: body.message ?? body.detail ?? "Request failed" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SERVER_GATEWAY_URL}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Reset failed" }));
      return { success: false, error: body.message ?? body.detail ?? "Password reset failed" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}
