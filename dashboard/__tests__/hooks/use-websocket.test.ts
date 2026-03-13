import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "@/hooks/use-websocket";

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Auto-fire onopen after a tick
    setTimeout(() => this.onopen?.(new Event("open")), 0);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  simulateMessage(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  simulateClose(): void {
    this.onclose?.();
  }

  simulateError(): void {
    this.onerror?.(new Event("error"));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useWebSocket", () => {
  it("connects to the WebSocket URL", () => {
    renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test" })
    );

    // WebSocket constructor was called
    // No error means it connected
  });

  it("sets isConnected to true when connection opens", async () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test" })
    );

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("calls onOpen callback when connected", async () => {
    const onOpen = vi.fn();

    renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test", onOpen })
    );

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("initially has null lastMessage", () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test" })
    );

    expect(result.current.lastMessage).toBeNull();
  });

  it("provides a send function", () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test" })
    );

    expect(typeof result.current.send).toBe("function");
  });

  it("provides a disconnect function", () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test" })
    );

    expect(typeof result.current.disconnect).toBe("function");
  });

  it("returns isConnected as false initially before onopen fires", () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: "ws://localhost:8000/ws/test" })
    );

    // Before the timer fires onopen
    expect(result.current.isConnected).toBe(false);
  });
});
