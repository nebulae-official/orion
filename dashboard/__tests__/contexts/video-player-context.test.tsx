import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  VideoPlayerProvider,
  useVideoPlayer,
} from "@/contexts/video-player-context";

describe("VideoPlayerProvider", () => {
  it("renders children", () => {
    render(
      <VideoPlayerProvider>
        <div>Child content</div>
      </VideoPlayerProvider>
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("provides initial currentTime of 0", () => {
    function Consumer(): React.ReactElement {
      const { currentTime } = useVideoPlayer();
      return <span>Time: {currentTime}</span>;
    }

    render(
      <VideoPlayerProvider>
        <Consumer />
      </VideoPlayerProvider>
    );

    expect(screen.getByText("Time: 0")).toBeInTheDocument();
  });

  it("updates currentTime via setCurrentTime", () => {
    function Consumer(): React.ReactElement {
      const { currentTime, setCurrentTime } = useVideoPlayer();
      return (
        <div>
          <span>Time: {currentTime}</span>
          <button onClick={() => setCurrentTime(42)}>Set time</button>
        </div>
      );
    }

    render(
      <VideoPlayerProvider>
        <Consumer />
      </VideoPlayerProvider>
    );

    fireEvent.click(screen.getByText("Set time"));
    expect(screen.getByText("Time: 42")).toBeInTheDocument();
  });

  it("registers and calls seekTo function", () => {
    const mockSeekFn = vi.fn();

    function Consumer(): React.ReactElement {
      const { seekTo, registerSeekTo } = useVideoPlayer();
      return (
        <div>
          <button onClick={() => registerSeekTo(mockSeekFn)}>Register</button>
          <button onClick={() => seekTo(10)}>Seek</button>
        </div>
      );
    }

    render(
      <VideoPlayerProvider>
        <Consumer />
      </VideoPlayerProvider>
    );

    // Register the seek function
    fireEvent.click(screen.getByText("Register"));

    // Call seekTo
    fireEvent.click(screen.getByText("Seek"));
    expect(mockSeekFn).toHaveBeenCalledWith(10);
  });

  it("seekTo is a no-op before registering", () => {
    function Consumer(): React.ReactElement {
      const { seekTo } = useVideoPlayer();
      return <button onClick={() => seekTo(10)}>Seek</button>;
    }

    render(
      <VideoPlayerProvider>
        <Consumer />
      </VideoPlayerProvider>
    );

    // Should not throw when no seekFn registered
    expect(() => fireEvent.click(screen.getByText("Seek"))).not.toThrow();
  });
});

describe("useVideoPlayer", () => {
  it("throws error when used outside VideoPlayerProvider", () => {
    // Suppress error output from React
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useVideoPlayer());
    }).toThrow("useVideoPlayer must be used within a VideoPlayerProvider");

    spy.mockRestore();
  });

  it("does not throw when used inside VideoPlayerProvider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <VideoPlayerProvider>{children}</VideoPlayerProvider>
    );

    const { result } = renderHook(() => useVideoPlayer(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.currentTime).toBe(0);
    expect(typeof result.current.seekTo).toBe("function");
    expect(typeof result.current.registerSeekTo).toBe("function");
    expect(typeof result.current.setCurrentTime).toBe("function");
  });
});
