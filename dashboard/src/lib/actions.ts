"use server";

import { revalidatePath } from "next/cache";
import { getAuthToken } from "@/lib/auth";
import type { Content, ContentFeedback } from "@/types/api";
import { DEMO_MODE, SERVER_GATEWAY_URL } from "@/lib/config";
import { demoSystemStatus, demoGatewayHealth } from "@/lib/demo-data";

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

export async function approveContent(
  contentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(
      `/api/v1/content/${contentId}/approve`,
      { method: "POST" }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Approve failed" }));
      return { success: false, error: body.message ?? "Failed to approve content" };
    }

    revalidatePath("/queue");
    revalidatePath(`/queue/${contentId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function rejectContent(
  contentId: string,
  feedback: ContentFeedback
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(
      `/api/v1/content/${contentId}/reject`,
      {
        method: "POST",
        body: JSON.stringify(feedback),
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Reject failed" }));
      return { success: false, error: body.message ?? "Failed to reject content" };
    }

    revalidatePath("/queue");
    revalidatePath(`/queue/${contentId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function fetchContent(
  contentId: string
): Promise<Content | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;

    const response = await authenticatedFetch(`/api/v1/content/${contentId}`);
    if (!response.ok) return null;

    return (await response.json()) as Content;
  } catch {
    return null;
  }
}

export async function publishContent(
  contentId: string,
  platforms: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(
      "/api/v1/publisher/publish/",
      {
        method: "POST",
        body: JSON.stringify({ content_id: contentId, platforms }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ detail: "Publish failed" }));
      return {
        success: false,
        error: body.detail ?? "Failed to publish content",
      };
    }

    revalidatePath("/queue");
    revalidatePath(`/queue/${contentId}`);
    revalidatePath("/publishing");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function saveProviderConfig(
  service: string,
  provider: string,
  model: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(
      `/api/v1/providers/${service}/config`,
      {
        method: "PUT",
        body: JSON.stringify({ provider, model }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ message: "Save failed" }));
      return {
        success: false,
        error: body.message ?? "Failed to save provider configuration",
      };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export interface DependencyChecks {
  redis: boolean;
  postgres: boolean;
}

export interface SystemStatusService {
  service: string;
  status: string;
  error?: string;
  uptime: string;
  queue_size: number;
  checks?: DependencyChecks;
}

export interface SystemStatusResponse {
  status: string;
  services: SystemStatusService[];
}

export async function fetchSystemStatus(): Promise<{
  data: SystemStatusResponse | null;
  authFailed: boolean;
}> {
  if (DEMO_MODE) {
    return { data: demoSystemStatus, authFailed: false };
  }
  try {
    const token = await getAuthToken();
    if (!token) {
      return { data: null, authFailed: true };
    }
    const response = await authenticatedFetch("/status");
    if (response.status === 401 || response.status === 403) {
      return { data: null, authFailed: true };
    }
    if (!response.ok) return { data: null, authFailed: false };
    return {
      data: (await response.json()) as SystemStatusResponse,
      authFailed: false,
    };
  } catch {
    return { data: null, authFailed: false };
  }
}

export async function fetchGatewayHealth(): Promise<{ status: string } | null> {
  if (DEMO_MODE) {
    return demoGatewayHealth;
  }
  try {
    const { SERVER_GATEWAY_URL } = await import("@/lib/config");
    const response = await fetch(`${SERVER_GATEWAY_URL}/health`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as { status: string };
  } catch {
    return null;
  }
}
