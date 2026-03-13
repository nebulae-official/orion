import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContentActions } from "@/components/content-actions";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock actions
vi.mock("@/lib/actions", () => ({
  approveContent: vi.fn().mockResolvedValue({ success: true }),
  rejectContent: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock publish-modal
vi.mock("@/components/publish-modal", () => ({
  PublishModal: ({ onClose }: { contentId: string; onClose: () => void }) => (
    <div data-testid="publish-modal">
      <button onClick={onClose}>Close publish</button>
    </div>
  ),
}));

// Mock ui/modal
vi.mock("@/components/ui/modal", () => ({
  Modal: ({
    isOpen,
    onClose,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="modal" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

describe("ContentActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Approve and Reject buttons for review status", () => {
    render(<ContentActions contentId="c1" status="review" />);

    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows Approve and Reject buttons for draft status", () => {
    render(<ContentActions contentId="c1" status="draft" />);

    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows Approved badge and Publish button for approved status", () => {
    render(<ContentActions contentId="c1" status="approved" />);

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });

  it("shows Rejected badge for rejected status", () => {
    render(<ContentActions contentId="c1" status="rejected" />);

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });

  it("hides action buttons for published status", () => {
    render(<ContentActions contentId="c1" status="published" />);

    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish")).not.toBeInTheDocument();
  });

  it("opens reject modal when Reject is clicked", () => {
    render(<ContentActions contentId="c1" status="review" />);

    fireEvent.click(screen.getByText("Reject"));

    expect(screen.getByText("Reject Content")).toBeInTheDocument();
    expect(
      screen.getByText("Reason for rejection")
    ).toBeInTheDocument();
  });

  it("opens publish modal when Publish is clicked", () => {
    render(<ContentActions contentId="c1" status="approved" />);

    fireEvent.click(screen.getByText("Publish"));

    expect(screen.getByTestId("publish-modal")).toBeInTheDocument();
  });

  it("calls approveContent when Approve is clicked", async () => {
    const { approveContent } = await import("@/lib/actions");
    render(<ContentActions contentId="c1" status="review" />);

    fireEvent.click(screen.getByText("Approve"));

    expect(approveContent).toHaveBeenCalledWith("c1");
  });

  it("shows regenerate checkbox in reject modal", () => {
    render(<ContentActions contentId="c1" status="review" />);

    fireEvent.click(screen.getByText("Reject"));

    expect(
      screen.getByText("Regenerate content with feedback")
    ).toBeInTheDocument();
  });

  it("shows Cancel button in reject modal", () => {
    render(<ContentActions contentId="c1" status="review" />);

    fireEvent.click(screen.getByText("Reject"));

    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
