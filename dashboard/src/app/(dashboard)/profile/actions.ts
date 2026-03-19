"use server";

import { getAuthToken } from "@/lib/auth";
import { DEMO_MODE, SERVER_GATEWAY_URL } from "@/lib/config";
import { revalidatePath } from "next/cache";

export async function updateProfile(data: {
  name: string;
  bio: string;
  timezone: string;
  avatar_url: string | null;
}): Promise<{ success: boolean; error?: string }> {
  if (DEMO_MODE) {
    return { success: true };
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await fetch(
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/me`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Update failed" }));
      return {
        success: false,
        error: body.message ?? body.detail ?? "Failed to update profile",
      };
    }

    revalidatePath("/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (DEMO_MODE) {
    return { success: true };
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await fetch(
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/me/password`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Password change failed" }));
      return {
        success: false,
        error: body.message ?? body.detail ?? "Failed to change password",
      };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}
