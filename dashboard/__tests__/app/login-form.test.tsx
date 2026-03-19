import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginForm from "@/app/(auth)/login/login-form";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
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

// Mock auth
vi.mock("@/lib/auth", () => ({
  login: vi.fn(),
}));

// Mock config
vi.mock("@/lib/config", () => ({
  GATEWAY_URL: "http://localhost:8000",
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form", () => {
    render(<LoginForm />);

    expect(screen.getByText("Welcome to Orion")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to the Content Agency dashboard")
    ).toBeInTheDocument();
  });

  it("renders username input", () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText("Email or Username");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "text");
    expect(emailInput).toBeRequired();
  });

  it("renders password input", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toBeRequired();
  });

  it("renders Sign in button", () => {
    render(<LoginForm />);

    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("renders Orion branding footer", () => {
    render(<LoginForm />);

    expect(
      screen.getByText("Orion Digital Twin Content Agency")
    ).toBeInTheDocument();
  });

  it("updates username on input change", () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText("Email or Username");
    fireEvent.change(emailInput, { target: { value: "testuser" } });
    expect(emailInput).toHaveValue("testuser");
  });

  it("updates password on input change", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    expect(passwordInput).toHaveValue("secret123");
  });

  it("calls login with credentials on form submit", async () => {
    const { login } = await import("@/lib/auth");
    vi.mocked(login).mockResolvedValue({ success: true });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    fireEvent.submit(screen.getByText("Sign in").closest("form")!);

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin", "pass");
    });
  });

  it("shows error message on failed login", async () => {
    const { login } = await import("@/lib/auth");
    vi.mocked(login).mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "bad" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "bad" },
    });

    fireEvent.click(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("navigates to home after successful login", async () => {
    const { login } = await import("@/lib/auth");
    vi.mocked(login).mockResolvedValue({ success: true });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("has placeholder text for email", () => {
    render(<LoginForm />);

    expect(
      screen.getByPlaceholderText("Enter your email or username")
    ).toBeInTheDocument();
  });

  it("has placeholder text for password", () => {
    render(<LoginForm />);

    expect(
      screen.getByPlaceholderText("Enter your password")
    ).toBeInTheDocument();
  });
});
