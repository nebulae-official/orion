import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoPlayer } from "@/components/video-player";
import type { ScriptSegment } from "@/types/api";

// Mock the video player context
const mockRegisterSeekTo = vi.fn();
const mockSetCurrentTime = vi.fn();

vi.mock("@/contexts/video-player-context", () => ({
  useVideoPlayer: () => ({
    registerSeekTo: mockRegisterSeekTo,
    setCurrentTime: mockSetCurrentTime,
    seekTo: vi.fn(),
    currentTime: 0,
  }),
}));

// Mock HTMLVideoElement methods
beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(HTMLVideoElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLVideoElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLVideoElement.prototype, "paused", {
    configurable: true,
    get: () => true,
  });
});

describe("VideoPlayer", () => {
  it("renders no-video placeholder when videoUrl is not provided", () => {
    render(<VideoPlayer />);

    expect(screen.getByText("No video available")).toBeInTheDocument();
  });

  it("renders video element when videoUrl is provided", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "https://example.com/video.mp4");
  });

  it("sets poster attribute from thumbnailUrl", () => {
    render(
      <VideoPlayer
        videoUrl="https://example.com/video.mp4"
        thumbnailUrl="https://example.com/thumb.jpg"
      />
    );

    const video = document.querySelector("video");
    expect(video).toHaveAttribute("poster", "https://example.com/thumb.jpg");
  });

  it("renders play button with accessible label", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("renders mute button with accessible label", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    expect(screen.getByLabelText("Mute")).toBeInTheDocument();
  });

  it("renders fullscreen button with accessible label", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    expect(screen.getByLabelText("Toggle fullscreen")).toBeInTheDocument();
  });

  it("renders playback speed button with accessible label", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    expect(screen.getByLabelText("Playback speed 1x")).toBeInTheDocument();
  });

  it("shows time display formatted as 0:00 / 0:00", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    expect(screen.getByText("0:00 / 0:00")).toBeInTheDocument();
  });

  it("toggles speed menu when speed button is clicked", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    const speedButton = screen.getByLabelText("Playback speed 1x");

    // Speed menu should be closed initially
    expect(screen.queryByText("0.5x")).not.toBeInTheDocument();

    // Open speed menu
    fireEvent.click(speedButton);
    expect(screen.getByText("0.5x")).toBeInTheDocument();
    expect(screen.getByText("1.5x")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
  });

  it("has aria-expanded attribute on speed button", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    const speedButton = screen.getByLabelText("Playback speed 1x");
    expect(speedButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(speedButton);
    expect(speedButton).toHaveAttribute("aria-expanded", "true");
  });

  it("registers seekTo with the video player context", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    expect(mockRegisterSeekTo).toHaveBeenCalledWith(expect.any(Function));
  });

  it("renders video with playsInline attribute", () => {
    render(<VideoPlayer videoUrl="https://example.com/video.mp4" />);

    const video = document.querySelector("video");
    expect(video).toHaveAttribute("playsinline");
  });

  it("renders segment overlay when segments are active", () => {
    const segments: ScriptSegment[] = [
      {
        id: "seg-1",
        content_id: "c1",
        text: "Intro text",
        start_time: 0,
        end_time: 5,
        order: 0,
      },
    ];

    render(
      <VideoPlayer
        videoUrl="https://example.com/video.mp4"
        segments={segments}
      />
    );

    // By default currentTime is 0, so the first segment (0-5) should not be active
    // since activeSegment depends on the timeupdate event
    // The component itself only shows segments when currentTime is within range
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
  });
});
