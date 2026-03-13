import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContentCard, ContentCardSkeleton } from "@/components/content-card";
import type { Content } from "@/types/api";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockContent: Content = {
  id: "test-123",
  title: "Test Content Title",
  body: "This is the body of the test content.",
  status: "review",
  thumbnail_url: "https://example.com/thumb.jpg",
  video_url: "https://example.com/video.mp4",
  confidence_score: 0.85,
  created_at: "2025-03-13T10:00:00Z",
};

describe("ContentCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders content title", () => {
    render(<ContentCard content={mockContent} />);

    expect(screen.getByText("Test Content Title")).toBeInTheDocument();
  });

  it("renders content body", () => {
    render(<ContentCard content={mockContent} />);

    expect(
      screen.getByText("This is the body of the test content.")
    ).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<ContentCard content={mockContent} />);

    expect(screen.getByText("In Review")).toBeInTheDocument();
  });

  it("renders confidence score", () => {
    render(<ContentCard content={mockContent} />);

    expect(screen.getByText("85% confidence")).toBeInTheDocument();
  });

  it("links to the content detail page", () => {
    render(<ContentCard content={mockContent} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/queue/test-123");
  });

  it("renders thumbnail image when provided", () => {
    render(<ContentCard content={mockContent} />);

    const img = screen.getByAltText("Test Content Title");
    expect(img).toBeInTheDocument();
  });

  it("does not render confidence when undefined", () => {
    const noScoreContent = { ...mockContent, confidence_score: undefined };
    render(<ContentCard content={noScoreContent} />);

    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
  });
});

describe("ContentCardSkeleton", () => {
  it("renders skeleton container", () => {
    const { container } = render(<ContentCardSkeleton />);

    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });
});
