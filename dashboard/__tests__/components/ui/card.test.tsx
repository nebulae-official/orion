import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

afterEach(() => {
  cleanup();
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card body</Card>);
    expect(screen.getByText("Card body")).toBeInTheDocument();
  });

  it("applies default classes", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("border");
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("p-6");
  });

  it("merges custom className", () => {
    render(<Card className="mt-8" data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("mt-8");
    expect(card.className).toContain("rounded-xl");
  });

  it("forwards HTML attributes", () => {
    render(<Card role="region" aria-label="test">Content</Card>);
    expect(screen.getByRole("region", { name: "test" })).toBeInTheDocument();
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Header text</CardHeader>);
    expect(screen.getByText("Header text")).toBeInTheDocument();
  });

  it("applies default classes", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId("header");
    expect(header.className).toContain("mb-4");
    expect(header.className).toContain("flex");
    expect(header.className).toContain("flex-col");
  });

  it("merges custom className", () => {
    render(<CardHeader className="pb-2" data-testid="header">Header</CardHeader>);
    expect(screen.getByTestId("header").className).toContain("pb-2");
  });
});

describe("CardTitle", () => {
  it("renders as h3 element", () => {
    render(<CardTitle>Title</CardTitle>);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Title");
  });

  it("applies default classes", () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    const title = screen.getByTestId("title");
    expect(title.className).toContain("text-lg");
    expect(title.className).toContain("font-semibold");
    expect(title.className).toContain("text-text");
  });

  it("merges custom className", () => {
    render(<CardTitle className="text-xl" data-testid="title">Big Title</CardTitle>);
    expect(screen.getByTestId("title").className).toContain("text-xl");
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Body text</CardContent>);
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("applies default classes", () => {
    render(<CardContent data-testid="content">Body</CardContent>);
    const content = screen.getByTestId("content");
    expect(content.className).toContain("text-sm");
    expect(content.className).toContain("text-text-secondary");
  });

  it("merges custom className", () => {
    render(<CardContent className="mt-2" data-testid="content">Extra</CardContent>);
    expect(screen.getByTestId("content").className).toContain("mt-2");
  });
});

describe("Card composition", () => {
  it("renders a complete card with header, title, and content", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>My Card</CardTitle>
        </CardHeader>
        <CardContent>Some content here</CardContent>
      </Card>
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("My Card");
    expect(screen.getByText("Some content here")).toBeInTheDocument();
  });
});
