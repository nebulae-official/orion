import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueueFilters } from "@/components/queue-filters";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe("QueueFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all status filter buttons", () => {
    render(<QueueFilters currentSort="date" />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("renders sort options", () => {
    render(<QueueFilters currentSort="date" />);

    expect(screen.getByText("Sort by:")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("highlights the All button when no status is selected", () => {
    render(<QueueFilters currentSort="date" />);

    const allButton = screen.getByText("All");
    expect(allButton).toHaveClass("bg-primary");
  });

  it("highlights the current status button", () => {
    render(<QueueFilters currentStatus="review" currentSort="date" />);

    const reviewButton = screen.getByText("In Review");
    expect(reviewButton).toHaveClass("bg-primary");

    const allButton = screen.getByText("All");
    expect(allButton).not.toHaveClass("bg-primary");
  });

  it("highlights the current sort button", () => {
    render(<QueueFilters currentSort="score" />);

    const scoreButton = screen.getByText("Score");
    expect(scoreButton).toHaveClass("bg-surface-elevated");
  });

  it("navigates when a status filter is clicked", () => {
    render(<QueueFilters currentSort="date" />);

    fireEvent.click(screen.getByText("Draft"));

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("status=draft")
    );
  });

  it("navigates when All status filter is clicked removing status param", () => {
    render(<QueueFilters currentStatus="draft" currentSort="date" />);

    fireEvent.click(screen.getByText("All"));

    // "all" should delete the status param
    expect(mockPush).toHaveBeenCalledWith(
      expect.not.stringContaining("status=")
    );
  });

  it("navigates when a sort option is clicked", () => {
    render(<QueueFilters currentSort="date" />);

    fireEvent.click(screen.getByText("Score"));

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("sort=score")
    );
  });

  it("removes page param when a filter is changed", () => {
    // Pre-set page param
    const paramsWithPage = new URLSearchParams("page=3&status=draft");
    vi.mocked(mockSearchParams).toString = () => paramsWithPage.toString();

    render(<QueueFilters currentStatus="draft" currentSort="date" />);

    fireEvent.click(screen.getByText("Approved"));

    const calledUrl = mockPush.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("page=");
  });
});
