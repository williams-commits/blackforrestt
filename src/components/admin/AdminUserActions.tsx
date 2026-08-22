"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { fmtDateTime } from "@/lib/dates";

export interface ManagedUserRow {
  id: string;
  email: string | null;
  name: string | null;
  accountNo: string | null;
  isAdmin: boolean;
  suspendedAt: string | null;
  blockedAt: string | null;
  deletedAt: string | null;
}

type DialogKind =
  | { kind: "status"; action: "SUSPEND" | "UNSUSPEND" | "BLOCK" | "UNBLOCK" | "SOFT_DELETE" | "RESTORE" }
  | { kind: "notify" }
  | null;

const STATUS_LABELS: Record<string, { verb: string; tone: string }> = {
  SUSPEND: { verb: "Suspend", tone: "text-down" },
  UNSUSPEND: { verb: "Unsuspend", tone: "text-up" },
  BLOCK: { verb: "Block", tone: "text-down" },
  UNBLOCK: { verb: "Unblock", tone: "text-up" },
  SOFT_DELETE: { verb: "Delete", tone: "text-down" },
  RESTORE: { verb: "Restore", tone: "text-up" },
};

/** Row-level admin actions: account state, direct notification. Renders a
 *  compact inline menu; destructive actions confirm with a note first. */
export function AdminUserActions({ user, onChanged, onOpenChat }: {
  user: ManagedUserRow;
  onChanged: () => void;
  onOpenChat: (user: ManagedUserRow) => void;
}) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = user.deletedAt ? "deleted" : user.blockedAt ? "blocked" : user.suspendedAt ? "suspended" : "active";

  async function submitStatus(action: NonNullable<DialogKind> & { kind: "status" } extends never ? never : "SUSPEND" | "UNSUSPEND" | "BLOCK" | "UNBLOCK" | "SOFT_DELETE" | "RESTORE") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Action failed.");
      setDialog(null);
      setNote("");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitNotify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Send failed.");
      setDialog(null);
      setTitle("");
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  const statusAction: "SUSPEND" | "UNSUSPEND" | "BLOCK" | "UNBLOCK" | "SOFT_DELETE" | "RESTORE" =
    state === "deleted" ? "RESTORE"
    : state === "blocked" ? "UNBLOCK"
    : state === "suspended" ? "UNSUSPEND"
    : "SUSPEND";
  const secondaryAction = state === "active" ? "BLOCK" : null;
  const deleteAction = state === "deleted" ? null : "SOFT_DELETE";

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span className={`mr-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${state === "active" ? "bg-up/10 text-up" : state === "suspended" ? "bg-brand-soft text-brand" : "bg-down/10 text-down"}`}>
          {state}
        </span>
        <button type="button" onClick={() => { setError(null); setNote(""); setDialog({ kind: "notify" }); }} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-panel-2">Notify</button>
        <button type="button" onClick={() => onOpenChat(user)} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-panel-2">Chat</button>
        {!user.isAdmin && (
          <>
            <button type="button" onClick={() => { setError(null); setNote(""); setDialog({ kind: "status", action: statusAction }); }} className={`rounded border border-border px-2 py-1 text-[10px] hover:bg-panel-2 ${STATUS_LABELS[statusAction].tone}`}>
              {STATUS_LABELS[statusAction].verb}
            </button>
            {secondaryAction && (
              <button type="button" onClick={() => { setError(null); setNote(""); setDialog({ kind: "status", action: secondaryAction }); }} className="rounded border border-border px-2 py-1 text-[10px] text-down hover:bg-down/10">
                {STATUS_LABELS[secondaryAction].verb}
              </button>
            )}
            {deleteAction && (
              <button type="button" onClick={() => { setError(null); setNote(""); setDialog({ kind: "status", action: deleteAction }); }} className="rounded border border-down/40 px-2 py-1 text-[10px] text-down hover:bg-down/10">
                {STATUS_LABELS[deleteAction].verb}
              </button>
            )}
          </>
        )}
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => { if (!busy) { setDialog(null); setError(null); } }}
        title={dialog?.kind === "notify" ? "Send notification" : `${STATUS_LABELS[(dialog as { action: string } | null)?.action ?? ""]?.verb ?? "Confirm"} account`}
        description={dialog?.kind === "notify"
          ? `Delivered instantly to ${user.email ?? "the user"}'s notification history.`
          : dialog?.action === "SOFT_DELETE"
            ? "Soft-delete blocks sign-in and hides the account; all financial history is preserved and it can be restored."
            : "The user is notified in-app and the action is written to the audit trail."}
        className="max-w-md"
      >
        <form
          className="p-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!dialog) return;
            if (dialog.kind === "notify") void submitNotify();
            else void submitStatus(dialog.action);
          }}
        >
          {dialog?.kind === "notify" ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="notify-title">Title</label>
                <input id="notify-title" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="notify-body">Message</label>
                <textarea id="notify-body" required minLength={3} maxLength={2000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="status-note">Note (optional, shown to the user in-app)</label>
              <textarea id="status-note" maxLength={500} rows={4} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
              {(user.suspendedAt || user.blockedAt || user.deletedAt) && (
                <p className="mt-2 text-[10px] text-text-faint">
                  Since: {fmtDateTime(user.suspendedAt ?? user.blockedAt ?? user.deletedAt!)}
                </p>
              )}
            </div>
          )}
          {error && <p role="alert" className="rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => { setDialog(null); setError(null); }} className="rounded border border-border px-3 py-2 text-xs disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className={`rounded px-3 py-2 text-xs text-white disabled:opacity-50 ${dialog?.kind === "notify" ? "bg-brand" : "bg-down"}`}>
              {busy ? "Working…" : dialog?.kind === "notify" ? "Send notification" : "Confirm"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
