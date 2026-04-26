"use server";

import { cookies } from "next/headers";
import { SERVER_GATEWAY_URL } from "@/lib/config";
import type { AuthResponse, User } from "@/types/api";

export async function completeOnboarding(data: {
  username: string;
  password: string;
  confirm_password: string;
  first_name?: string;
  last_name?: string;
  timezone: string;
}): Promise<{ success: boolean; error?: string }> {
  if (data.password !== data.confirm_password) {
    return { success: false, error: "Passwords do not match" };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;
  const refreshToken = cookieStore.get("orion_refresh_token")?.value;

  if (!token) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Complete onboarding via identity service
    const response = await fetch(
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/me/onboarding`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          first_name: data.first_name,
          last_name: data.last_name,
          timezone: data.timezone,
        }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Onboarding failed" }));
      return {
        success: false,
        error: body.message ?? body.detail ?? "Failed to complete setup",
      };
    }

    // Refresh the token to get a new JWT without the onboarding claim
    const refreshResponse = await fetch(
      `${SERVER_GATEWAY_URL}/api/v1/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken ?? "" }),
      }
    );

    if (!refreshResponse.ok) {
      // Onboarding succeeded but token refresh failed — user may need to re-login
      return {
        success: false,
        error: "Setup complete but session refresh failed. Please log in again.",
      };
    }

    const authData: AuthResponse = await refreshResponse.json();
    const expiresAt = new Date(Date.now() + authData.expires_in * 1000);

    cookieStore.set("orion_token", authData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    cookieStore.set("orion_token_expiry", expiresAt.toISOString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    if (authData.refresh_token) {
      const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      cookieStore.set("orion_refresh_token", authData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: refreshExpiry,
      });
    }

    // Update the user cookie with the username
    const updatedUser: User = {
      ...authData.user,
      username: data.username,
    };
    cookieStore.set("orion_user", JSON.stringify(updatedUser), {
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

export async function checkUsername(
  username: string
): Promise<{ available: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token) {
    return { available: false };
  }

  try {
    const response = await fetch(
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/check-username?username=${encodeURIComponent(username)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return { available: false };
    }

    const data = (await response.json()) as { available: boolean };
    return { available: data.available };
  } catch {
    return { available: false };
  }
}
