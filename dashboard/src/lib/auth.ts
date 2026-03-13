"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthResponse, User } from "@/types/api";
import { GATEWAY_URL } from "@/lib/config";
const TOKEN_COOKIE = "orion_token";
const TOKEN_EXPIRY_COOKIE = "orion_token_expiry";
const USER_COOKIE = "orion_user";

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
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

    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
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

  if (!token || !expiryStr) return null;

  const expiry = new Date(expiryStr);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  // Refresh if token expires in less than 5 minutes
  if (expiry.getTime() - now.getTime() > fiveMinutes) {
    return token;
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

    return data.access_token;
  } catch {
    return null;
  }
}
