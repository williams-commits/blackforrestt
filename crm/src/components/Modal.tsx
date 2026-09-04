"use client";

import { useEffect, useRef } from "react";

/**
 * Modal focus trap — accessible dialog behavior:
 * - Traps Tab/Shift+Tab within the modal
 * - ESC closes
 * - Click on backdrop closes
 * - Auto-focuses the first focusable element
 * - Restores focus to the trigger element on close
 */
export function Modal({
  onClose,
  children,
  title,
  size = "md",
  closeOnBackdrop = true,
}: {
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    // Focus the dialog itself (or first focusable)
    const dialog = dialogRef.current;
    if (dialog) {
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0]!.focus();
      } else {
        dialog.focus();
      }
    }
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null); // visible only
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sizeClass =
    size === "sm" ? "max-w-sm" :
    size === "md" ? "max-w-lg" :
    size === "lg" ? "max-w-2xl" :
    "max-w-4xl";

  return (
    <div
      className="modal-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`modal ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        {title ? (
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-lg"
              style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
