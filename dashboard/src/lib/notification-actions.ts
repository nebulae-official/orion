"use server";

import { getAuthToken } from "@/lib/auth";
import { SERVER_GATEWAY_URL } from "@/lib/config";

async function authenticatedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  return fetch(`${SERVER_GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchNotifications(
  page = 1,
  pageSize = 20,
  unread = false
): Promise<NotificationListResponse | null> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (unread) params.set("unread", "true");

    const response = await authenticatedFetch(
      `/api/v1/identity/notifications?${params.toString()}`
    );
    if (!response.ok) return null;
    return (await response.json()) as NotificationListResponse;
  } catch {
    return null;
  }
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const response = await authenticatedFetch(
      "/api/v1/identity/notifications/unread-count"
    );
    if (!response.ok) return 0;
    const data = (await response.json()) as { count: number };
    return data.count;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(
  id: string
): Promise<{ status: string } | null> {
  try {
    const response = await authenticatedFetch(
      `/api/v1/identity/notifications/${id}/read`,
      { method: "PATCH" }
    );
    if (!response.ok) return null;
    return (await response.json()) as { status: string };
  } catch {
    return null;
  }
}

export async function markAllNotificationsRead(): Promise<{
  status: string;
  marked: number;
} | null> {
  try {
    const response = await authenticatedFetch(
      "/api/v1/identity/notifications/read-all",
      { method: "POST" }
    );
    if (!response.ok) return null;
    return (await response.json()) as { status: string; marked: number };
  } catch {
    return null;
  }
}
