"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Modal — now backed by shadcn/ui's Dialog (Radix). Same public API as the
 * hand-rolled version: title, size, onClose, optional backdrop-close veto.
 * Radix provides the focus trap, ESC handling, and restore. The close X is
 * rendered here (not by DialogContent) so it always calls onClose directly —
 * closeOnBackdrop={false} vetoes backdrop/ESC, never the X.
 */
export function Modal({
  onClose,
  children,
  title,
  size = "md",
  closeOnBackdrop = true,
}: {
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
}) {
  const sizeClass =
    size === "sm" ? "max-w-sm" : size === "md" ? "max-w-lg" : size === "lg" ? "max-w-2xl" : "max-w-4xl";
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && closeOnBackdrop) onClose();
      }}
    >
      <DialogContent className={cn(sizeClass)} showCloseButton={false}>
        <DialogHeader>
          {title ? <DialogTitle>{title}</DialogTitle> : <DialogTitle className="sr-only">Dialog</DialogTitle>}
          <DialogDescription className="sr-only">{title ?? "Dialog"}</DialogDescription>
        </DialogHeader>
        {children}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
