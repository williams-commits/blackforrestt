"use client";

import { type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/*
  Accessible modal dialog on Radix (the repo's shadcn approach). Radix
  provides the focus trap, Escape handling, focus restore, scroll lock and
  aria wiring that this component previously hand-rolled. The public API
  (open/onClose/icon/title/description/children/className/closeLabel) and
  the terminal styling are unchanged — mobile renders full-bleed, sm+
  centers as a bordered canvas panel.
*/

interface DialogProps {
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
  closeLabel?: string;
}

export function Dialog({
  open,
  onClose,
  icon,
  title,
  description,
  children,
  className,
  closeLabel = "Close dialog",
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex h-dvh max-h-dvh w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-none border border-border bg-canvas shadow-2xl outline-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <DialogPrimitive.Title className="text-sm font-semibold text-text">
                <span className="mr-2 inline-flex align-[-2px] text-text-muted">{icon}</span>
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-xs text-text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className="flex items-center rounded-lg p-1 text-2xl leading-none text-text-faint hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
