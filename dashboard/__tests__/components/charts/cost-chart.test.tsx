import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostChart } from "@/components/charts/cost-chart";

// Mock recharts
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
  Legend: () => <div data-testid="legend" />,
}));

const mockData = [
  {
    provider: "OpenAI",
    total_cost: 12.5,
    by_category: { llm_tokens: 10.0, image_generation: 2.5 },
  },
  {
    provider: "Ollama",
    total_cost: 0,
    by_category: { llm_tokens: 0 },
  },
];

describe("CostChart", () => {
  it("renders the Cost by Provider heading", () => {
    render(<CostChart data={mockData} />);

    expect(screen.getByText("Cost by Provider")).toBeInTheDocument();
  });

  it("renders the chart when data is provided", () => {
    render(<CostChart data={mockData} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<CostChart data={[]} />);

    expect(screen.getByText("No cost data yet")).toBeInTheDocument();
  });

  it("does not render chart when data is empty", () => {
    render(<CostChart data={[]} />);

    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });
});
