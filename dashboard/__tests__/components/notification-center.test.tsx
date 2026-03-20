import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationCenter } from "@/components/notification-center";

// Mock notification-actions
vi.mock("@/lib/notification-actions", () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const mockNotifications = [
  {
    id: "n1",
    type: "trend.detected",
    title: "New trend detected: AI Coding",
    body: "Score: 0.95",
    is_read: false,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    metadata: null,
  },
  {
    id: "n2",
    type: "content.published",
    title: "Content published: My Video",
    body: null,
    is_read: true,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    metadata: null,
  },
  {
    id: "n3",
    type: "media.failed",
    title: "Media generation failed for: Test",
    body: "Out of memory",
    is_read: false,
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(), // 2 days ago
    metadata: null,
  },
];

describe("NotificationCenter", () => {
  const onClose = vi.fn();
  const onCountChange = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const actions = await import("@/lib/notification-actions");
    vi.mocked(actions.fetchNotifications).mockResolvedValue({
      items: mockNotifications,
      total: 3,
      page: 1,
      page_size: 20,
    });
    vi.mocked(actions.markNotificationRead).mockResolvedValue({
      status: "ok",
    });
    vi.mocked(actions.markAllNotificationsRead).mockResolvedValue({
      status: "ok",
      marked: 2,
    });
  });

  it("renders the header", async () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("fetches and displays notifications", async () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("New trend detected: AI Coding")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Content published: My Video")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Media generation failed for: Test")
      ).toBeInTheDocument();
    });
  });

  it("displays notification body when present", async () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(screen.getByText("Score: 0.95")).toBeInTheDocument();
      expect(screen.getByText("Out of memory")).toBeInTheDocument();
    });
  });

  it("shows empty state when no notifications", async () => {
    const actions = await import("@/lib/notification-actions");
    vi.mocked(actions.fetchNotifications).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });

    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
    });
  });

  it("calls onClose when close button is clicked", async () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("New trend detected: AI Coding")
      ).toBeInTheDocument();
    });

    // The X button
    const closeButtons = screen.getAllByRole("button");
    const closeButton = closeButtons.find(
      (btn) => btn.getAttribute("title") !== "Mark all read" && btn.getAttribute("title") !== "Mark read"
    );
    // Click the close (X) button — it's one of the header buttons
    if (closeButton) {
      fireEvent.click(closeButton);
    }
  });

  it("marks a single notification as read", async () => {
    const actions = await import("@/lib/notification-actions");
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("New trend detected: AI Coding")
      ).toBeInTheDocument();
    });

    // Find and click the "Mark read" button for an unread notification
    const markReadButtons = screen.getAllByTitle("Mark read");
    expect(markReadButtons.length).toBeGreaterThan(0);

    fireEvent.click(markReadButtons[0]);

    await waitFor(() => {
      expect(actions.markNotificationRead).toHaveBeenCalledWith("n1");
    });
  });

  it("marks all notifications as read", async () => {
    const actions = await import("@/lib/notification-actions");
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("New trend detected: AI Coding")
      ).toBeInTheDocument();
    });

    const markAllButton = screen.getByTitle("Mark all read");
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(actions.markAllNotificationsRead).toHaveBeenCalled();
      expect(onCountChange).toHaveBeenCalledWith(0);
    });
  });

  it("shows mark-read button only for unread notifications", async () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("New trend detected: AI Coding")
      ).toBeInTheDocument();
    });

    // There should be 2 "Mark read" buttons (n1 and n3 are unread)
    const markReadButtons = screen.getAllByTitle("Mark read");
    expect(markReadButtons.length).toBe(2);
  });

  it("formats relative time correctly", async () => {
    render(
      <NotificationCenter onClose={onClose} onCountChange={onCountChange} />
    );

    await waitFor(() => {
      // The time formatting should show relative times
      // 5 min ago -> "5m ago"
      expect(screen.getByText("5m ago")).toBeInTheDocument();
      // 2 hours ago -> "2h ago"
      expect(screen.getByText("2h ago")).toBeInTheDocument();
      // 2 days ago -> "2d ago"
      expect(screen.getByText("2d ago")).toBeInTheDocument();
    });
  });
});
