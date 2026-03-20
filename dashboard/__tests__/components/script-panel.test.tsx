import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScriptPanel } from "@/components/script-panel";
import type { ScriptSegment } from "@/types/api";

const mockSeekTo = vi.fn();

vi.mock("@/contexts/video-player-context", () => ({
  useVideoPlayer: () => ({
    seekTo: mockSeekTo,
    registerSeekTo: vi.fn(),
    currentTime: 0,
    setCurrentTime: vi.fn(),
  }),
}));

const mockSegments: ScriptSegment[] = [
  {
    id: "seg-1",
    content_id: "c1",
    text: "Welcome to the show",
    start_time: 0,
    end_time: 5,
    order: 0,
  },
  {
    id: "seg-2",
    content_id: "c1",
    text: "Today we discuss AI",
    start_time: 5,
    end_time: 12,
    order: 1,
  },
  {
    id: "seg-3",
    content_id: "c1",
    text: "Thanks for watching",
    start_time: 60,
    end_time: 65,
    order: 2,
  },
];

describe("ScriptPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no script and no segments", () => {
    render(<ScriptPanel />);

    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(screen.getByText("No script available.")).toBeInTheDocument();
  });

  it("renders script text when provided without segments", () => {
    render(<ScriptPanel script="This is a full script text." />);

    expect(screen.getByText("This is a full script text.")).toBeInTheDocument();
  });

  it("renders segments when provided", () => {
    render(<ScriptPanel segments={mockSegments} />);

    expect(screen.getByText("Welcome to the show")).toBeInTheDocument();
    expect(screen.getByText("Today we discuss AI")).toBeInTheDocument();
    expect(screen.getByText("Thanks for watching")).toBeInTheDocument();
  });

  it("renders timestamps for segments", () => {
    render(<ScriptPanel segments={mockSegments} />);

    expect(screen.getByText(/0:00 - 0:05/)).toBeInTheDocument();
    expect(screen.getByText(/0:05 - 0:12/)).toBeInTheDocument();
    expect(screen.getByText(/1:00 - 1:05/)).toBeInTheDocument();
  });

  it("calls seekTo when a segment is clicked", () => {
    render(<ScriptPanel segments={mockSegments} />);

    fireEvent.click(screen.getByText("Today we discuss AI"));
    expect(mockSeekTo).toHaveBeenCalledWith(5);
  });

  it("prefers segments over plain script when both provided", () => {
    render(
      <ScriptPanel script="Plain text" segments={mockSegments} />
    );

    expect(screen.getByText("Welcome to the show")).toBeInTheDocument();
    expect(screen.queryByText("Plain text")).not.toBeInTheDocument();
  });

  it("renders segment buttons as clickable elements", () => {
    render(<ScriptPanel segments={mockSegments} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(mockSegments.length);
  });

  it("renders the Script heading", () => {
    render(<ScriptPanel segments={mockSegments} />);

    expect(screen.getByText("Script")).toBeInTheDocument();
  });
});
