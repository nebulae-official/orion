import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar, MobileSidebarToggle } from "@/components/sidebar";

// Mock next/navigation
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lib/auth
vi.mock("@/lib/auth", () => ({
  logout: vi.fn(),
}));

describe("MobileSidebarToggle", () => {
  it("renders a button with accessible label", () => {
    const onClick = vi.fn();
    render(<MobileSidebarToggle onClick={onClick} />);

    const button = screen.getByLabelText("Open navigation menu");
    expect(button).toBeInTheDocument();
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<MobileSidebarToggle onClick={onClick} />);

    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
  });

  it("renders the Orion logo and brand", () => {
    render(<Sidebar />);

    expect(screen.getByText("Orion")).toBeInTheDocument();
    expect(screen.getByText("v1.0")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Content Queue")).toBeInTheDocument();
    expect(screen.getByText("Trends")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Publishing")).toBeInTheDocument();
    expect(screen.getByText("Generation")).toBeInTheDocument();
    expect(screen.getByText("System Health")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    render(<Sidebar />);

    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("renders navigation links with correct hrefs", () => {
    render(<Sidebar />);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/queue");
    expect(hrefs).toContain("/trends");
    expect(hrefs).toContain("/analytics");
    expect(hrefs).toContain("/publishing");
    expect(hrefs).toContain("/generation");
    expect(hrefs).toContain("/system");
    expect(hrefs).toContain("/settings");
  });

  it("renders the mobile open navigation button", () => {
    render(<Sidebar />);

    expect(screen.getByLabelText("Open navigation menu")).toBeInTheDocument();
  });

  it("renders the close navigation button for mobile", () => {
    render(<Sidebar />);

    expect(screen.getByLabelText("Close navigation menu")).toBeInTheDocument();
  });

  it("opens mobile sidebar when toggle is clicked", () => {
    const { container } = render(<Sidebar />);

    // Initially sidebar is translated off-screen on mobile
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("-translate-x-full");

    // Click the open button
    fireEvent.click(screen.getByLabelText("Open navigation menu"));

    // Now sidebar should be visible
    expect(aside).toHaveClass("translate-x-0");
  });

  it("closes mobile sidebar when close button is clicked", () => {
    const { container } = render(<Sidebar />);

    // Open the sidebar first
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("translate-x-0");

    // Click the close button
    fireEvent.click(screen.getByLabelText("Close navigation menu"));
    expect(aside).toHaveClass("-translate-x-full");
  });

  it("closes mobile sidebar when backdrop is clicked", () => {
    const { container } = render(<Sidebar />);

    // Open the sidebar
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("translate-x-0");

    // Click the backdrop
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);

    expect(aside).toHaveClass("-translate-x-full");
  });

  it("shows no backdrop when sidebar is closed", () => {
    const { container } = render(<Sidebar />);

    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeInTheDocument();
  });

  it("highlights the active navigation item for root path", () => {
    mockPathname.mockReturnValue("/");
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-primary-surface");
  });

  it("highlights the active navigation item for sub-path", () => {
    mockPathname.mockReturnValue("/queue/some-id");
    render(<Sidebar />);

    const queueLink = screen.getByText("Content Queue").closest("a");
    expect(queueLink).toHaveClass("bg-primary-surface");
  });

  it("calls logout when sign out is clicked", async () => {
    const { logout } = await import("@/lib/auth");
    render(<Sidebar />);

    fireEvent.click(screen.getByText("Sign out"));
    expect(logout).toHaveBeenCalled();
  });
});
