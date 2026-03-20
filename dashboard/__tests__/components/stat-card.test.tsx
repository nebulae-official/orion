import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/charts/stat-card";

describe("StatCard", () => {
  it("renders title and numeric value", () => {
    render(<StatCard title="Total Generated" value={42} />);

    expect(screen.getByText("Total Generated")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard title="Approval Rate" value="85.5%" />);

    expect(screen.getByText("Approval Rate")).toBeInTheDocument();
    expect(screen.getByText("85.5%")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <StatCard title="Total Cost" value="$12.50" subtitle="Last 30 days" />
    );

    expect(screen.getByText("Total Cost")).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    render(<StatCard title="Count" value={10} />);

    expect(screen.queryByText("Last 30 days")).not.toBeInTheDocument();
  });

  it("renders zero value", () => {
    render(<StatCard title="Empty" value={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
