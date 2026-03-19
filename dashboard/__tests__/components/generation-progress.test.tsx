import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerationProgress } from "@/components/generation-progress";

// Mock useWebSocket
let mockIsConnected = false;
let mockStatus = "reconnecting";
vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: (options: { onMessage?: (msg: unknown) => void }) => {
    return {
      isConnected: mockIsConnected,
      status: mockStatus,
      lastMessage: null,
      send: vi.fn(),
      disconnect: vi.fn(),
    };
  },
}));

describe("GenerationProgress", () => {
  beforeEach(() => {
    mockIsConnected = false;
    mockStatus = "reconnecting";
  });

  it("shows Reconnecting when not connected", () => {
    render(<GenerationProgress />);

    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("shows Live when connected", () => {
    mockIsConnected = true;
    mockStatus = "connected";
    render(<GenerationProgress />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows WebSocket unavailable when disconnected", () => {
    mockIsConnected = false;
    mockStatus = "disconnected";
    render(<GenerationProgress />);

    expect(screen.getByText("WebSocket unavailable")).toBeInTheDocument();
    expect(screen.getByText("Live updates unavailable. Refresh the page to retry.")).toBeInTheDocument();
  });

  it("shows empty state message when no active generations", () => {
    render(<GenerationProgress />);

    expect(
      screen.getByText(
        /No active generations/
      )
    ).toBeInTheDocument();
  });

  it("renders the connection status indicator dot", () => {
    const { container } = render(<GenerationProgress />);

    const dot = container.querySelector(".rounded-full.h-2.w-2");
    expect(dot).toBeInTheDocument();
  });

  it("shows red pulsing dot when disconnected", () => {
    const { container } = render(<GenerationProgress />);

    const dot = container.querySelector(".rounded-full.h-2.w-2");
    expect(dot).toHaveClass("animate-pulse");
    expect(dot).toHaveClass("bg-danger");
  });

  it("shows green dot when connected", () => {
    mockIsConnected = true;
    mockStatus = "connected";
    const { container } = render(<GenerationProgress />);

    const dot = container.querySelector(".rounded-full.h-2.w-2");
    expect(dot).toHaveClass("bg-success");
    expect(dot).not.toHaveClass("animate-pulse");
  });
});
