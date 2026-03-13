"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  // Capture the element that triggered the modal
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus trap and escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the first focusable element
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      clearTimeout(timer);

      // Restore focus to trigger element
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2
          id={titleId}
          className="text-lg font-semibold text-text"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body
  );
}
