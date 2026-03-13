import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DashboardLoading from "@/app/(dashboard)/loading";

describe("DashboardLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<DashboardLoading />);
    expect(container).toBeInTheDocument();
  });

  it("renders skeleton pulse animations", () => {
    const { container } = render(<DashboardLoading />);

    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders four stat card skeletons", () => {
    const { container } = render(<DashboardLoading />);

    // The stat cards grid has 4 items
    const gridContainer = container.querySelector(
      ".grid.grid-cols-1.gap-6.sm\\:grid-cols-2.lg\\:grid-cols-4"
    );
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer?.children.length).toBe(4);
  });

  it("renders eight content card skeletons", () => {
    const { container } = render(<DashboardLoading />);

    // The content cards grid has 8 items
    const grids = container.querySelectorAll(".grid");
    // Second grid is the content cards grid
    const contentGrid = grids[1];
    expect(contentGrid?.children.length).toBe(8);
  });

  it("renders header skeleton", () => {
    const { container } = render(<DashboardLoading />);

    // Header has two skeleton bars
    const headerSection = container.querySelector(".mb-8");
    expect(headerSection).toBeInTheDocument();
    expect(headerSection?.querySelectorAll(".animate-pulse").length).toBe(2);
  });
});
