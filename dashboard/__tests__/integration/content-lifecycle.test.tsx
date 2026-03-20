import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContentCard } from "@/components/content-card";
import { ContentActions } from "@/components/content-actions";
import { ToastProvider } from "@/components/toast";
import type { Content } from "@/types/api";

// Mock actions
const mockApproveContent = vi.fn();
const mockRejectContent = vi.fn();
vi.mock("@/lib/actions", () => ({
  approveContent: (...args: unknown[]) => mockApproveContent(...args),
  rejectContent: (...args: unknown[]) => mockRejectContent(...args),
}));

// Mock next/navigation
const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/queue",
  redirect: vi.fn(),
}));

// Mock publish modal to avoid deep dependency tree
vi.mock("@/components/publish-modal", () => ({
  PublishModal: () => null,
}));

function createMockContent(overrides: Partial<Content> = {}): Content {
  return {
    id: "content-001",
    title: "Test Video: AI Trends 2026",
    body: "A comprehensive look at the latest AI trends shaping the industry.",
    status: "review",
    confidence_score: 0.85,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("Content Lifecycle Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ContentCard rendering", () => {
    it("renders content card with title, body, and status", () => {
      const content = createMockContent();
      render(<ContentCard content={content} />);

      expect(screen.getByText("Test Video: AI Trends 2026")).toBeInTheDocument();
      expect(
        screen.getByText(
          "A comprehensive look at the latest AI trends shaping the industry."
        )
      ).toBeInTheDocument();
      expect(screen.getByText("In Review")).toBeInTheDocument();
    });

    it("displays confidence score as percentage", () => {
      const content = createMockContent({ confidence_score: 0.92 });
      render(<ContentCard content={content} />);

      expect(screen.getByText("92% confidence")).toBeInTheDocument();
    });

    it("links to the content detail page", () => {
      const content = createMockContent({ id: "abc-123" });
      render(<ContentCard content={content} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/queue/abc-123");
    });

    it("renders different status badges correctly", () => {
      const statuses = [
        { status: "draft" as const, label: "Draft" },
        { status: "generating" as const, label: "Generating" },
        { status: "review" as const, label: "In Review" },
        { status: "approved" as const, label: "Approved" },
        { status: "published" as const, label: "Published" },
        { status: "rejected" as const, label: "Rejected" },
      ];

      for (const { status, label } of statuses) {
        const { unmount } = render(
          <ContentCard content={createMockContent({ status })} />
        );
        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      }
    });

    it("renders placeholder when no thumbnail", () => {
      const content = createMockContent({ thumbnail_url: undefined });
      render(<ContentCard content={content} />);

      // No img element should exist
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("Content approve action", () => {
    it("calls approveContent and shows success on approve", async () => {
      mockApproveContent.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      renderWithProviders(
        <ContentActions contentId="content-001" status="review" />
      );

      const approveBtn = screen.getByRole("button", { name: /approve/i });
      expect(approveBtn).toBeInTheDocument();

      await user.click(approveBtn);

      await waitFor(() => {
        expect(mockApproveContent).toHaveBeenCalledWith("content-001");
      });

      // Should show approved status after optimistic update
      await waitFor(() => {
        expect(screen.getByText("Approved")).toBeInTheDocument();
      });
    });

    it("reverts to original status on approve failure", async () => {
      mockApproveContent.mockResolvedValue({
        success: false,
        error: "Server error",
      });
      const user = userEvent.setup();

      renderWithProviders(
        <ContentActions contentId="content-001" status="review" />
      );

      await user.click(screen.getByRole("button", { name: /approve/i }));

      await waitFor(() => {
        expect(mockApproveContent).toHaveBeenCalled();
      });

      // After failure, approve button should reappear (status reverts to review)
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /approve/i })
        ).toBeInTheDocument();
      });
    });

    it("does not show approve button for published content", () => {
      renderWithProviders(
        <ContentActions contentId="content-001" status="published" />
      );

      expect(
        screen.queryByRole("button", { name: /approve/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Content reject action", () => {
    it("opens reject modal and submits feedback", async () => {
      mockRejectContent.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      renderWithProviders(
        <ContentActions contentId="content-001" status="review" />
      );

      // Click reject to open modal
      await user.click(screen.getByRole("button", { name: /reject/i }));

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("Reject Content")).toBeInTheDocument();
      });

      // Fill in reason
      const textarea = screen.getByPlaceholderText(
        /explain why this content should be rejected/i
      );
      await user.type(textarea, "Quality too low");

      // Check regenerate checkbox
      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      // Submit — click the Reject button inside the modal (the one in the footer)
      const allRejectBtns = screen.getAllByRole("button", { name: /^reject$/i });
      // The modal's submit button is the last one (inside the modal footer)
      const submitBtn = allRejectBtns[allRejectBtns.length - 1];
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockRejectContent).toHaveBeenCalledWith("content-001", {
          reason: "Quality too low",
          regenerate: true,
        });
      });
    });

    it("shows rejected status after successful rejection", async () => {
      mockRejectContent.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      renderWithProviders(
        <ContentActions contentId="content-001" status="review" />
      );

      await user.click(screen.getByRole("button", { name: /reject/i }));

      await waitFor(() => {
        expect(screen.getByText("Reject Content")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /explain why this content should be rejected/i
      );
      await user.type(textarea, "Not relevant");

      const allRejectBtns2 = screen.getAllByRole("button", { name: /^reject$/i });
      await user.click(allRejectBtns2[allRejectBtns2.length - 1]);

      // After optimistic update, should show Rejected status
      await waitFor(() => {
        expect(screen.getByText("Rejected")).toBeInTheDocument();
      });
    });

    it("can cancel the reject modal", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <ContentActions contentId="content-001" status="review" />
      );

      await user.click(screen.getByRole("button", { name: /reject/i }));

      await waitFor(() => {
        expect(screen.getByText("Reject Content")).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Reject Content")).not.toBeInTheDocument();
      });

      // Reject action should not have been called
      expect(mockRejectContent).not.toHaveBeenCalled();
    });

    it("does not show reject button for published content", () => {
      renderWithProviders(
        <ContentActions contentId="content-001" status="published" />
      );

      expect(
        screen.queryByRole("button", { name: /reject/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Content status transitions", () => {
    it("shows publish button for approved content", () => {
      renderWithProviders(
        <ContentActions contentId="content-001" status="approved" />
      );

      expect(
        screen.getByRole("button", { name: /publish/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });

    it("shows approve and reject buttons for draft content", () => {
      renderWithProviders(
        <ContentActions contentId="content-001" status="draft" />
      );

      expect(
        screen.getByRole("button", { name: /approve/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reject/i })
      ).toBeInTheDocument();
    });
  });
});
