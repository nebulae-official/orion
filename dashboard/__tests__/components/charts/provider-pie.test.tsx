import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderPie } from "@/components/charts/provider-pie";

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockData = [
  {
    provider: "OpenAI",
    total_cost: 25.0,
    by_category: { llm_tokens: 20.0, image_generation: 5.0 },
  },
  {
    provider: "Replicate",
    total_cost: 10.0,
    by_category: { video_clips: 10.0 },
  },
];

describe("ProviderPie", () => {
  it("renders the Provider Usage heading", () => {
    render(<ProviderPie data={mockData} />);

    expect(screen.getByText("Provider Usage")).toBeInTheDocument();
  });

  it("renders the pie chart when data is provided", () => {
    render(<ProviderPie data={mockData} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<ProviderPie data={[]} />);

    expect(screen.getByText("No provider data yet")).toBeInTheDocument();
  });

  it("does not render chart when data is empty", () => {
    render(<ProviderPie data={[]} />);

    expect(screen.queryByTestId("pie-chart")).not.toBeInTheDocument();
  });
});
