import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NotificationBell } from "@/components/notification-bell";

// Mock the useWebSocket hook
const mockOnMessage = vi.fn();
vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: (opts: { url: string; onMessage: (msg: unknown) => void }) => {
    // Store the callback so tests can trigger it
    mockOnMessage.mockImplementation(opts.onMessage);
    return {
      isConnected: true,
      status: "connected" as const,
      lastMessage: null,
      send: vi.fn(),
      disconnect: vi.fn(),
    };
  },
  WebSocketMessage: {},
}));

// Mock NotificationCenter
vi.mock("@/components/notification-center", () => ({
  NotificationCenter: ({
    onClose,
    onCountChange,
  }: {
    onClose: () => void;
    onCountChange: (count: number) => void;
  }) => (
    <div data-testid="notification-center">
      <button onClick={onClose} data-testid="close-center">
        Close
      </button>
    </div>
  ),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the bell icon", () => {
    render(<NotificationBell initialCount={0} wsUrl="ws://test" />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("shows badge when initialCount > 0", () => {
    render(<NotificationBell initialCount={5} wsUrl="ws://test" />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hides badge when initialCount is 0", () => {
    render(<NotificationBell initialCount={0} wsUrl="ws://test" />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("caps badge display at 99+", () => {
    render(<NotificationBell initialCount={150} wsUrl="ws://test" />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("toggles notification center on click", () => {
    render(<NotificationBell initialCount={0} wsUrl="ws://test" />);

    // Initially not open
    expect(screen.queryByTestId("notification-center")).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByTestId("notification-center")).toBeInTheDocument();

    // Click again to close
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.queryByTestId("notification-center")).not.toBeInTheDocument();
  });

  it("increments count on WebSocket notification message", () => {
    render(<NotificationBell initialCount={3} wsUrl="ws://test" />);

    // Simulate a WebSocket notification
    act(() => {
      mockOnMessage({ type: "notification" });
    });

    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("does not increment count for non-notification messages", () => {
    render(<NotificationBell initialCount={3} wsUrl="ws://test" />);

    // Simulate a non-notification WebSocket message
    act(() => {
      mockOnMessage({ type: "system.update" });
    });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("updates count when initialCount prop changes", () => {
    const { rerender } = render(
      <NotificationBell initialCount={3} wsUrl="ws://test" />
    );
    expect(screen.getByText("3")).toBeInTheDocument();

    rerender(<NotificationBell initialCount={7} wsUrl="ws://test" />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
