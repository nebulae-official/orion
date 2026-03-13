import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FunnelChart } from "@/components/charts/funnel-chart";

// Mock recharts to avoid canvas/SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
}));

const mockData = [
  { stage: "Research", count: 100, color: "#8b5cf6" },
  { stage: "Script", count: 85, color: "#06b6d4" },
  { stage: "Video", count: 60, color: "#10b981" },
];

describe("FunnelChart", () => {
  it("renders the Content Pipeline heading", () => {
    render(<FunnelChart data={mockData} />);

    expect(screen.getByText("Content Pipeline")).toBeInTheDocument();
  });

  it("renders the chart container", () => {
    render(<FunnelChart data={mockData} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders a bar chart", () => {
    render(<FunnelChart data={mockData} />);

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders without crashing with empty data", () => {
    render(<FunnelChart data={[]} />);

    expect(screen.getByText("Content Pipeline")).toBeInTheDocument();
  });
});
