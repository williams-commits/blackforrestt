"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Drawer } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";

/**
 * Bulk note creation drawer — one note body applied to every selected
 * record of one object. Posts to /api/notes/bulk, which reuses the
 * single-note pipeline per record (scope, activity, audit, owner
 * notification). The caller clears the selection and refreshes rows via
 * onSuccess; the drawer stays open only when nothing landed.
 */

const MAX_PLAIN = 5000; // mirror of NOTE_MAX_PLAIN in the notes service — the server enforces it authoritatively.

export function BulkNoteDrawer({
  open,
  subjectType,
  selectedIds,
  recordLabel,
  onClose,
  onSuccess,
}: {
  open: boolean;
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER";
  selectedIds: string[];
  /** Object singular, e.g. "lead" — used in the count sentence and toasts. */
  recordLabel: string;
  onClose: () => void;
  /** Fired after a submission that created at least one note. */
  onSuccess: () => void | Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBody("");
      setError(null);
    }
  }, [open]);

  const count = selectedIds.length;
  const plain = body.trim();
  const validation =
    plain.length === 0
      ? "Note cannot be empty."
      : plain.length > MAX_PLAIN
        ? `Note is too long — keep it under ${MAX_PLAIN.toLocaleString()} characters.`
        : null;

  async function submit() {
    if (busy) return;
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/notes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectIds: selectedIds, body }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { requestedCount: number; createdCount: number; failures: Array<{ subjectId: string; message: string }> }; error?: string }
        | null;
      const data = payload?.data;
      if (!response.ok || !data) {
        throw new Error(payload?.error ?? "Unable to add notes.");
      }
      if (data.createdCount === 0) {
        // Nothing landed — keep the drawer open with the first reason.
        setError(data.failures[0]?.message ?? "Unable to add notes.");
        return;
      }
      if (data.failures.length > 0) {
        toast.error(`Note added to ${data.createdCount} of ${data.requestedCount} ${recordLabel}s`, {
          description: `${data.failures.length} ${data.failures.length === 1 ? "record" : "records"} failed — they may be outside your scope.`,
        });
      } else {
        toast.success(`Note added to ${data.createdCount} ${count === 1 ? recordLabel : `${recordLabel}s`}`, {
          description: count === 1 ? undefined : `One note on each selected ${recordLabel}.`,
        });
      }
      onClose();
      await onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add notes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      title="Add note"
      subtitle={`The same note will be added to ${count} selected ${count === 1 ? recordLabel : `${recordLabel}s`}.`}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" loading={busy} disabled={busy || count === 0} onClick={() => void submit()}>
            {count === 1 ? "Add note" : `Add note to ${count} records`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label htmlFor="bulk-note-body" className="block text-sm font-medium">
          Note
        </label>
        <Textarea
          id="bulk-note-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write one note for every selected record…"
          rows={8}
          disabled={busy}
          aria-invalid={Boolean(error)}
        />
        <p className="text-xs text-muted-foreground">
          {plain.length.toLocaleString()} / {MAX_PLAIN.toLocaleString()} characters
        </p>
        {error ? (
          <p role="alert" className="text-sm text-(--error)">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
