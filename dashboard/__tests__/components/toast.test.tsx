import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/toast";

// Mock crypto.randomUUID
beforeEach(() => {
  let counter = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => `test-uuid-${++counter}`,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function TestTrigger(): React.ReactElement {
  const { toast } = useToast();

  return (
    <div>
      <button onClick={() => toast("success", "Success message")}>
        Show success
      </button>
      <button onClick={() => toast("error", "Error message")}>
        Show error
      </button>
      <button onClick={() => toast("info", "Info message")}>
        Show info
      </button>
    </div>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children", () => {
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders a toast notification region", () => {
    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
  });

  it("displays a success toast", () => {
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("displays an error toast", () => {
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show error"));
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("displays an info toast", () => {
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show info"));
    expect(screen.getByText("Info message")).toBeInTheDocument();
  });

  it("auto-dismisses toast after 4 seconds", () => {
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
  });

  it("dismisses toast when dismiss button is clicked", () => {
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
  });

  it("displays multiple toasts simultaneously", () => {
    render(
      <ToastProvider>
        <TestTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show success"));
    fireEvent.click(screen.getByText("Show error"));

    expect(screen.getByText("Success message")).toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("has aria-live polite on the notification region", () => {
    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});

describe("useToast outside provider", () => {
  it("returns a no-op toast function when used outside provider", () => {
    function Standalone(): React.ReactElement {
      const { toast } = useToast();
      return <button onClick={() => toast("success", "test")}>Toast</button>;
    }

    // Should not throw when used outside provider
    render(<Standalone />);
    fireEvent.click(screen.getByText("Toast"));
  });
});
