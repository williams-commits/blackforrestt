"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Confirmation dialog for destructive or consequential actions.
 * Wraps the accessible Dialog (Escape, focus trap) with a consistent
 * danger-styled confirm button.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? () => undefined : onCancel} title={title} className="max-w-sm">
      <div className="p-5">
        <p className="text-sm text-text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" size="sm" variant="sell" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
