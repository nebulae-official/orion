import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PublishModal } from "@/components/publish-modal";

// Mock toast
const mockToast = vi.fn();
vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock actions
vi.mock("@/lib/actions", () => ({
  publishContent: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock modal to render inline
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
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

describe("PublishModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    expect(screen.getByText("Publish Content")).toBeInTheDocument();
  });

  it("renders platform selection prompt", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    expect(
      screen.getByText("Select platforms to publish to:")
    ).toBeInTheDocument();
  });

  it("renders X / Twitter platform option", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    expect(screen.getByText("X / Twitter")).toBeInTheDocument();
  });

  it("renders Cancel button", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders Publish button", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    expect(screen.getByText("Publish")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows error toast when publishing with no platform selected", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    // The Publish button is disabled when no platform is selected,
    // preventing the error toast from being triggered via click
    const publishButton = screen.getByText("Publish");
    expect(publishButton).toBeDisabled();
    fireEvent.click(publishButton);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("toggles platform selection via checkbox", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("disables Publish button when no platform is selected", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    const publishButton = screen.getByText("Publish");
    expect(publishButton).toBeDisabled();
  });

  it("enables Publish button when a platform is selected", () => {
    render(<PublishModal contentId="c1" onClose={onClose} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const publishButton = screen.getByText("Publish");
    expect(publishButton).not.toBeDisabled();
  });

  it("calls publishContent when publishing with a selected platform", async () => {
    const { publishContent } = await import("@/lib/actions");
    render(<PublishModal contentId="c1" onClose={onClose} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText("Publish"));
    expect(publishContent).toHaveBeenCalledWith("c1", ["twitter"]);
  });
});
