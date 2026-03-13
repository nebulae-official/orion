import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Button } from "@/components/ui/button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies primary variant classes by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole("button", { name: "Primary" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-white");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button", { name: "Secondary" });
    expect(button.className).toContain("bg-surface");
    expect(button.className).toContain("border");
  });

  it("applies danger variant classes", () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("bg-danger");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button.className).toContain("hover:bg-surface-hover");
    expect(button.className).not.toContain("bg-primary");
  });

  it("applies size sm classes", () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole("button", { name: "Small" });
    expect(button.className).toContain("px-3");
    expect(button.className).toContain("text-xs");
  });

  it("applies size md classes by default", () => {
    render(<Button>Medium</Button>);
    const button = screen.getByRole("button", { name: "Medium" });
    expect(button.className).toContain("px-4");
    expect(button.className).toContain("text-sm");
  });

  it("applies size lg classes", () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole("button", { name: "Large" });
    expect(button.className).toContain("px-5");
    expect(button.className).toContain("text-base");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("cursor-not-allowed");
    expect(button.className).toContain("opacity-60");
  });

  it("is disabled when loading is true", () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole("button", { name: "Loading" });
    expect(button).toBeDisabled();
  });

  it("renders a spinner when loading", () => {
    render(<Button loading>Spin</Button>);
    const svg = screen.getByRole("button", { name: "Spin" }).querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.classList.contains("animate-spin")).toBe(true);
  });

  it("does not render a spinner when not loading", () => {
    render(<Button>Normal</Button>);
    const svg = screen.getByRole("button", { name: "Normal" }).querySelector("svg");
    expect(svg).toBeNull();
  });

  it("calls onClick handler when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clickable</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Clickable" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>NoClick</Button>);
    fireEvent.click(screen.getByRole("button", { name: "NoClick" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(<Button className="mt-4">Custom</Button>);
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button.className).toContain("mt-4");
  });

  it("forwards additional HTML attributes", () => {
    render(<Button type="submit" data-testid="submit-btn">Submit</Button>);
    const button = screen.getByTestId("submit-btn");
    expect(button).toHaveAttribute("type", "submit");
  });
});
