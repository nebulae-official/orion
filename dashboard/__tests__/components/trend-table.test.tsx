import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrendTable } from "@/components/trend-table";

const mockTrends = [
  {
    id: "t1",
    topic: "AI Content Generation",
    source: "Reddit",
    virality_score: 8.5,
    status: "NEW",
    created_at: "2025-03-13T10:00:00Z",
  },
  {
    id: "t2",
    topic: "Short Form Video",
    source: "Twitter",
    virality_score: 9.2,
    status: "PROCESSING",
    created_at: "2025-03-12T10:00:00Z",
  },
  {
    id: "t3",
    topic: "Machine Learning",
    source: "HackerNews",
    virality_score: 7.1,
    status: "USED",
    created_at: "2025-03-11T10:00:00Z",
  },
];

describe("TrendTable", () => {
  it("renders empty state when no trends provided", () => {
    render(<TrendTable trends={[]} />);

    expect(
      screen.getByText("No trends found. Scout may not be running.")
    ).toBeInTheDocument();
  });

  it("renders table with column headers", () => {
    render(<TrendTable trends={mockTrends} />);

    expect(screen.getByText("Topic")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Virality")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it("renders trend data rows", () => {
    render(<TrendTable trends={mockTrends} />);

    expect(screen.getByText("AI Content Generation")).toBeInTheDocument();
    expect(screen.getByText("Short Form Video")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
  });

  it("renders source names", () => {
    render(<TrendTable trends={mockTrends} />);

    expect(screen.getByText("Reddit")).toBeInTheDocument();
    expect(screen.getByText("Twitter")).toBeInTheDocument();
    expect(screen.getByText("HackerNews")).toBeInTheDocument();
  });

  it("renders virality scores formatted to one decimal", () => {
    render(<TrendTable trends={mockTrends} />);

    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("9.2")).toBeInTheDocument();
    expect(screen.getByText("7.1")).toBeInTheDocument();
  });

  it("renders status badges", () => {
    render(<TrendTable trends={mockTrends} />);

    expect(screen.getByText("NEW")).toBeInTheDocument();
    expect(screen.getByText("PROCESSING")).toBeInTheDocument();
    expect(screen.getByText("USED")).toBeInTheDocument();
  });

  it("sorts by column when header is clicked", () => {
    render(<TrendTable trends={mockTrends} />);

    // Default sort is by created_at descending
    const rows = screen.getAllByRole("row");
    // First row is header, data starts at index 1
    expect(rows[1]).toHaveTextContent("AI Content Generation");

    // Click on Topic to sort by topic
    fireEvent.click(screen.getByText("Topic"));

    // Sort should now show descending by topic
    const rowsAfterSort = screen.getAllByRole("row");
    expect(rowsAfterSort[1]).toHaveTextContent("Short Form Video");
  });

  it("toggles sort direction when same column is clicked twice", () => {
    render(<TrendTable trends={mockTrends} />);

    // Click on Virality to sort descending
    fireEvent.click(screen.getByText("Virality"));
    let rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Short Form Video"); // 9.2

    // Click again to sort ascending (header now shows "Virality ↓")
    fireEvent.click(screen.getByText(/Virality/));
    rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Machine Learning"); // 7.1
  });

  it("shows sort indicator arrow on active column", () => {
    render(<TrendTable trends={mockTrends} />);

    // Default sort is created_at descending
    // The arrow character is included in the header text
    const createdHeader = screen.getByText(/Created/);
    expect(createdHeader.textContent).toContain("\u2193"); // down arrow
  });

  it("renders a table element", () => {
    render(<TrendTable trends={mockTrends} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
