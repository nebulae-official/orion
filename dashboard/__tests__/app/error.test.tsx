import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardError from "@/app/(dashboard)/error";

describe("DashboardError", () => {
  it("renders the error heading", () => {
    const error = new Error("Test error");
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the error description", () => {
    const error = new Error("Test error");
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(
      screen.getByText(
        /An unexpected error occurred while loading this page/
      )
    ).toBeInTheDocument();
  });

  it("renders Try again button", () => {
    const error = new Error("Test error");
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("calls reset when Try again is clicked", () => {
    const error = new Error("Test error");
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("displays error digest when provided", () => {
    const error = Object.assign(new Error("Test error"), {
      digest: "abc123",
    });
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.getByText("Error reference: abc123")).toBeInTheDocument();
  });

  it("does not display error digest when not provided", () => {
    const error = new Error("Test error");
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.queryByText(/Error reference/)).not.toBeInTheDocument();
  });
});
