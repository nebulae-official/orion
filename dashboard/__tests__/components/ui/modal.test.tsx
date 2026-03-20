import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Modal } from "@/components/ui/modal";

describe("Modal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByText("Test Modal")).not.toBeInTheDocument();
    expect(screen.queryByText("Modal content")).not.toBeInTheDocument();
  });

  it("renders content when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("has dialog role with aria-modal", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("has aria-labelledby referencing the title", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    const titleId = dialog.getAttribute("aria-labelledby");
    expect(titleId).toBe("modal-title-test-modal");

    const titleElement = document.getElementById(titleId!);
    expect(titleElement).toHaveTextContent("Test Modal");
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sets body overflow to hidden when open", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body overflow when closed", () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("");
  });

  it("renders the title as an h2 element", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Title">
        <p>Content</p>
      </Modal>
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("My Title");
  });

  it("focuses first focusable element when opened", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Focus Test">
        <button>First button</button>
        <button>Second button</button>
      </Modal>
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });

    // The first focusable element should be focused (could be a button in the dialog)
    const focusedElement = document.activeElement;
    expect(focusedElement).toBeInstanceOf(HTMLButtonElement);
  });

  it("generates unique title id from the title prop", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Multi Word Title">
        <p>Content</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("modal-title-multi-word-title");
  });
});
