import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorTrend } from "@/components/charts/error-trend";

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="grid" />,
}));

const mockData = [
  {
    timestamp: "2025-03-07T00:00:00Z",
    error_count: 3,
    total_count: 100,
    error_rate: 0.03,
  },
  {
    timestamp: "2025-03-08T00:00:00Z",
    error_count: 5,
    total_count: 120,
    error_rate: 0.0417,
  },
];

describe("ErrorTrend", () => {
  it("renders the Error Trends heading", () => {
    render(<ErrorTrend data={mockData} />);

    expect(
      screen.getByText("Error Trends (last 7 days)")
    ).toBeInTheDocument();
  });

  it("renders the line chart when data is provided", () => {
    render(<ErrorTrend data={mockData} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<ErrorTrend data={[]} />);

    expect(screen.getByText("No error data yet")).toBeInTheDocument();
  });

  it("does not render chart when data is empty", () => {
    render(<ErrorTrend data={[]} />);

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });
});
