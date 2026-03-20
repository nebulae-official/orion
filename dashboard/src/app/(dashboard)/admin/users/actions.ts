"use server";

import { getAuthToken } from "@/lib/auth";
import { DEMO_MODE, SERVER_GATEWAY_URL } from "@/lib/config";
import { revalidatePath } from "next/cache";

export async function updateUserRole(
  userId: string,
  role: "admin" | "editor" | "viewer"
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
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/${userId}/role`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Update failed" }));
      return {
        success: false,
        error: body.message ?? body.detail ?? "Failed to update role",
      };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function toggleUserStatus(
  userId: string,
  active: boolean
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
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/${userId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: active }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Update failed" }));
      return {
        success: false,
        error: body.message ?? body.detail ?? "Failed to update status",
      };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function inviteUser(
  email: string,
  role: "admin" | "editor" | "viewer"
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
      `${SERVER_GATEWAY_URL}/api/v1/identity/users/invite`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Invite failed" }));
      return {
        success: false,
        error: body.message ?? body.detail ?? "Failed to send invitation",
      };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}
