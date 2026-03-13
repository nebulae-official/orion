import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "@/app/(auth)/login/login-form";

// Mock the auth module
const mockLogin = vi.fn();
vi.mock("@/lib/auth", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

// Capture router mock
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/login",
  redirect: vi.fn(),
}));

describe("Auth Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with username and password fields", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects to dashboard on successful login", async () => {
    mockLogin.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin", "secret");
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("displays error message on failed login", async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    // Router should NOT have been called
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows loading state during login", async () => {
    // Create a promise that we can control
    let resolveLogin: (value: { success: boolean }) => void;
    mockLogin.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Should show loading text
    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });

    // Button should be disabled
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    // Resolve the login
    resolveLogin!({ success: true });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
  });

  it("displays network error on login failure", async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: "Network error. Please try again.",
    });
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Network error. Please try again.")
      ).toBeInTheDocument();
    });
  });

  it("renders branding text", () => {
    render(<LoginForm />);

    expect(screen.getByText("Welcome to Orion")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to the Content Agency dashboard")
    ).toBeInTheDocument();
  });
});
