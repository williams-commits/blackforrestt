"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { Ellipsis, Bell, Check, Copy, FileText, KeyRound, LogOut, Mail, MessageSquare, Send, Trash2, X } from "lucide-react";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { ADMIN_ACTION_ICONS, TabIcon } from "@/components/ui/tabIcons";
import { fmtDateTime } from "@/lib/dates";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  | { kind: "resetPassword" }
  | { kind: "forceSignOut" }
  | { kind: "hardDelete" }
  | null;

type ResetMode = "temporary" | "link";

type ResetResult =
  | { mode: "link"; sent: boolean; previewUrl?: string; expiresAt: string }
  | { mode: "temporary"; temporaryPassword: string };

// Icon per account-state action (keys mirror STATUS_LABELS).
const STATUS_LABELS: Record<string, { verb: string; tone: string }> = {
  SUSPEND: { verb: "Suspend", tone: "text-down" },
  UNSUSPEND: { verb: "Unsuspend", tone: "text-up" },
  BLOCK: { verb: "Block", tone: "text-down" },
  UNBLOCK: { verb: "Unblock", tone: "text-up" },
  SOFT_DELETE: { verb: "Delete", tone: "text-down" },
  RESTORE: { verb: "Restore", tone: "text-up" },
};

/** Row-level admin actions behind one kebab menu (portal-rendered so the
 *  table's overflow container can't clip it): notify, chat, finance, settings,
 *  and the account-state controls. Destructive actions confirm with a note. */
export function AdminUserActions({ user, onChanged, onOpenChat, onManageBalance, onEditSettings, onProposeRole, canManage = false }: {
  user: ManagedUserRow;
  onChanged: () => void;
  onOpenChat: (user: ManagedUserRow) => void;
  onManageBalance?: (user: ManagedUserRow) => void;
  onEditSettings?: (user: ManagedUserRow) => void;
  /** Propose a role change through the maker-checker Approvals flow. */
  onProposeRole?: (user: ManagedUserRow, action: "ASSIGN_ROLE" | "REVOKE_ROLE") => void;
  /** USER_ACCESS_MANAGE holders see the account-state controls. */
  canManage?: boolean;
}) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [resetMode, setResetMode] = useState<ResetMode>("temporary");
  const [copiedValue, setCopiedValue] = useState(false);

  const state = user.deletedAt ? "deleted" : user.blockedAt ? "blocked" : user.suspendedAt ? "suspended" : "active";

  // Keep the kebab menu inside the viewport: once rendered, measure it
  // against the space under the trigger and flip it ABOVE the kebab when it
  // would run past the bottom edge (rows near the page bottom); clamp with
  // internal scrolling as the last resort on very short viewports.
  async function submitStatus(action: "SUSPEND" | "UNSUSPEND" | "BLOCK" | "UNBLOCK" | "SOFT_DELETE" | "RESTORE") {
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

  async function submitPasswordReset() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        resetMode === "temporary"
          ? `/api/admin/users/${user.id}/temporary-password`
          : `/api/admin/users/${user.id}/password-reset`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Reset failed.");
      setResetResult(
        resetMode === "temporary"
          ? { mode: "temporary", temporaryPassword: data.temporaryPassword as string }
          : { mode: "link", sent: data.sent !== false, previewUrl: data.previewUrl, expiresAt: data.expiresAt },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForceSignOut() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/sessions/revoke`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Sign-out failed.");
      setDialog(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitHardDelete() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/hard-delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      setDialog(null);
      setNote("");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(true);
      setTimeout(() => setCopiedValue(false), 2000);
    } catch { /* clipboard blocked */ }
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
      <div className="flex items-center justify-end gap-1.5">
        <Badge variant="secondary" className={`px-1.5 py-0 text-xs font-semibold uppercase ${state === "active" ? "bg-(--term-success-bg) text-(--term-success-fg)" : state === "suspended" ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : "bg-(--term-danger-bg) text-(--term-danger-fg)"}`}>
          {state}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${user.name ?? user.email ?? user.id}`}
            >
              <TabIcon icon={Ellipsis} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => { setError(null); setNote(""); setDialog({ kind: "notify" }); }}>
              <TabIcon icon={ADMIN_ACTION_ICONS.notify} /> Notify
              <span className="ml-auto text-xs text-muted-foreground">in-app</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenChat(user)}>
              <TabIcon icon={ADMIN_ACTION_ICONS.chat} /> Chat
              <span className="ml-auto text-xs text-muted-foreground">conversation</span>
            </DropdownMenuItem>
            {onManageBalance && (
              <DropdownMenuItem onClick={() => onManageBalance(user)}>
                <TabIcon icon={ADMIN_ACTION_ICONS.manageBalance} /> Manage balance
                <span className="ml-auto text-xs text-muted-foreground">audited</span>
              </DropdownMenuItem>
            )}
            {onEditSettings && (
              <DropdownMenuItem onClick={() => onEditSettings(user)}>
                <TabIcon icon={ADMIN_ACTION_ICONS.settings} /> Settings
                <span className="ml-auto text-xs text-muted-foreground">overrides</span>
              </DropdownMenuItem>
            )}
            {onProposeRole && (
              <>
                <DropdownMenuItem onClick={() => onProposeRole(user, "ASSIGN_ROLE")}>
                  <TabIcon icon={ADMIN_ACTION_ICONS.grantRole} /> Assign role
                  <span className="ml-auto text-xs text-muted-foreground">approval</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onProposeRole(user, "REVOKE_ROLE")}>
                  <TabIcon icon={ADMIN_ACTION_ICONS.revokeRole} /> Revoke role
                  <span className="ml-auto text-xs text-muted-foreground">approval</span>
                </DropdownMenuItem>
              </>
            )}
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setError(null); setResetResult(null); setDialog({ kind: "resetPassword" }); }}>
                  <TabIcon icon={ADMIN_ACTION_ICONS.resetPassword} /> Reset password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setError(null); setDialog({ kind: "forceSignOut" }); }}>
                  <TabIcon icon={ADMIN_ACTION_ICONS.forceSignOut} /> Force sign out
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setError(null); setDialog({ kind: "status", action: statusAction }); }}>
                  <TabIcon icon={ADMIN_ACTION_ICONS.suspend} /> {statusAction.replaceAll("_", " ").toLowerCase()}
                </DropdownMenuItem>
                {secondaryAction && (
                  <DropdownMenuItem variant="destructive" onClick={() => { setError(null); setDialog({ kind: "status", action: secondaryAction }); }}>
                    <TabIcon icon={ADMIN_ACTION_ICONS.suspend} /> {secondaryAction.replaceAll("_", " ").toLowerCase()}
                  </DropdownMenuItem>
                )}
                {deleteAction && (
                  <DropdownMenuItem variant="destructive" onClick={() => { setError(null); setDialog({ kind: "hardDelete" }); }}>
                    <TabIcon icon={ADMIN_ACTION_ICONS.hardDelete} /> Delete permanently
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => { if (!busy) { setDialog(null); setError(null); setResetResult(null); } }}
        title={dialog?.kind === "notify"
          ? "Send notification"
          : dialog?.kind === "resetPassword"
            ? resetResult
              ? resetResult.mode === "temporary" ? "Temporary password set" : "Reset link ready"
              : "Reset password"
            : dialog?.kind === "forceSignOut"
              ? "Sign out everywhere"
            : dialog?.kind === "hardDelete"
              ? "Delete permanently"
            : `${STATUS_LABELS[(dialog as { action: string } | null)?.action ?? ""]?.verb ?? "Confirm"} account`}
        description={dialog?.kind === "notify"
          ? `Delivered instantly to ${user.email ?? "the user"}'s notification history.`
          : dialog?.kind === "hardDelete"
            ? `Irreversibly removes ${user.email ?? "this account"} and every associated record. Accounts with ledger history are refused.`
            : dialog?.kind === "forceSignOut"
            ? `Every active session for ${user.email ?? "the user"} is revoked; they can simply sign in again.`
            : dialog?.kind === "resetPassword"
            ? `Set a generated sign-in code for ${user.email ?? "the user"}, or email them a self-service reset link.`
            : dialog?.action === "SOFT_DELETE"
              ? "Soft-delete blocks sign-in and hides the account; all financial history is preserved and it can be restored."
              : "The user is notified in-app and the action is written to the audit trail."}
        className="max-w-md"
      >
        {dialog?.kind === "resetPassword" && resetResult ? (
          <div className="p-5 space-y-4">
            {resetResult.mode === "temporary" ? (
              <>
                <Alert tone="ok">
                  New sign-in password generated — it is shown below exactly once.
                </Alert>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2.5 text-center font-mono text-xl font-bold tracking-widest">{resetResult.temporaryPassword}</code>
                    <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void copyValue(resetResult.temporaryPassword)}>
                      {copiedValue ? <Check size={13} strokeWidth={2} aria-hidden /> : <Copy size={13} strokeWidth={2} aria-hidden />}
                      {copiedValue ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Case-sensitive, 6 characters. Deliver it to the user through a secure channel — the user should
                    change it after signing in (Account → Security).
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  All active sessions were signed out and any login lockout was cleared — the user signs in fresh
                  with this password. This action is written to the audit trail (the password itself is never recorded).
                </p>
              </>
            ) : (
              <>
                <Alert tone={resetResult.sent ? "ok" : "info"}>
                  {resetResult.sent
                    ? `Reset link emailed to ${user.email}.`
                    : "Email delivery is not configured — use the link below."}
                </Alert>
                <p className="text-xs text-muted-foreground">
                  Valid until {fmtDateTime(resetResult.expiresAt)}. The user sets their own new password;
                  existing sessions stay signed in until the reset is completed.
                </p>
                {resetResult.previewUrl && (
                  <div className="space-y-2">
                    <Label className="block text-xs font-medium">Single-use reset link</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={resetResult.previewUrl}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="min-w-0 flex-1 font-mono text-xs"
                      />
                      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void copyValue(resetResult.previewUrl!)}>
                        {copiedValue ? <Check size={13} strokeWidth={2} aria-hidden /> : <Copy size={13} strokeWidth={2} aria-hidden />}
                        {copiedValue ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Hand this to the user through a secure channel — anyone with the link can set the password.</p>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setDialog(null); setError(null); setResetResult(null); }}><X size={13} strokeWidth={2} aria-hidden /> Close</Button>
            </div>
          </div>
        ) : (
        <form
          className="p-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!dialog) return;
            if (dialog.kind === "notify") void submitNotify();
            else if (dialog.kind === "resetPassword") void submitPasswordReset();
            else if (dialog.kind === "forceSignOut") void submitForceSignOut();
            else if (dialog.kind === "hardDelete") void submitHardDelete();
            else void submitStatus(dialog.action);
          }}
        >
          {dialog?.kind === "notify" ? (
            <>
              <div>
                <Label htmlFor="notify-title" className="mb-1 block text-xs font-medium">Title</Label>
                <Input id="notify-title" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance window" startIcon={<Bell size={13} strokeWidth={2} aria-hidden />} />
              </div>
              <div>
                <Label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="notify-body">Message</Label>
                <Textarea id="notify-body" required minLength={3} maxLength={2000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the in-app notification…" startIcon={<MessageSquare size={13} strokeWidth={2} aria-hidden />} />
              </div>
            </>
          ) : dialog?.kind === "hardDelete" ? (
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="purge-note">Purge reason (audited, min 10 chars)</Label>
              <Textarea
                id="purge-note"
                required
                minLength={10}
                maxLength={500}
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="GDPR erasure request, fraud cleanup, or compliance reference…"
                className="resize-none"
                startIcon={<FileText size={13} strokeWidth={2} aria-hidden />}
              />
              <p className="mt-2 text-xs text-down">
                This cannot be undone. The account, positions, transactions, documents, and chat history are
                destroyed immediately. The audit entry recording this deletion is permanent. Accounts that ever
                moved funds are protected by the ledger and will be refused.
              </p>
            </div>
          ) : dialog?.kind === "forceSignOut" ? (
            <p className="text-xs text-muted-foreground">
              All devices and browsers are signed out immediately — useful when an account may be
              compromised, or before handing control back to a customer after support. Open
              WebSockets drop on their next validation. The action is written to the audit trail.
            </p>
          ) : dialog?.kind === "resetPassword" ? (
            <div className="space-y-3">
              <ChipGroup
                ariaLabel="Reset method"
                className="flex-wrap"
                value={resetMode}
                onChange={(mode) => setResetMode(mode)}
                options={[
                  { value: "temporary", label: "Generate temporary password" },
                  { value: "link", label: "Email reset link" },
                ]}
              />
              {resetMode === "temporary" ? (
                <p className="text-xs text-muted-foreground">
                  Generates a random 6-character alphanumeric password and sets it on{" "}
                  <strong className="text-foreground">{user.email}</strong> immediately. All active sessions are signed out
                  and any login lockout is cleared, so the user can sign in right away. The code is shown to you once —
                  deliver it securely; the user should change it after signing in.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The link goes to <strong className="text-foreground">{user.email}</strong> and is valid for 30 minutes.
                  Completing the reset signs out all of the user&apos;s active sessions and clears any login lockout.
                  Issuing a new link invalidates previously issued, unused links. This action is written to the audit trail.
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="status-note">Note (optional, shown to the user in-app)</Label>
              <Textarea id="status-note" maxLength={500} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason shown to the user…" startIcon={<FileText size={13} strokeWidth={2} aria-hidden />} />
              {(user.suspendedAt || user.blockedAt || user.deletedAt) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Since: {fmtDateTime(user.suspendedAt ?? user.blockedAt ?? user.deletedAt!)}
                </p>
              )}
            </div>
          )}
          {error && <Alert tone="err">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => { setDialog(null); setError(null); }}><X size={13} strokeWidth={2} aria-hidden /> Cancel</Button>
            <Button type="submit" size="sm" variant={dialog?.kind === "status" ? "destructive" : "default"} disabled={busy} loading={busy}>
              {busy ? "Working…" : dialog?.kind === "notify"
                ? <><Send size={13} strokeWidth={2} aria-hidden /> Send notification</>
              : dialog?.kind === "resetPassword"
                ? <>{resetMode === "temporary" ? <KeyRound size={13} strokeWidth={2} aria-hidden /> : <Mail size={13} strokeWidth={2} aria-hidden />} {resetMode === "temporary" ? "Generate password" : "Send reset link"}</>
              : dialog?.kind === "forceSignOut"
                ? <><LogOut size={13} strokeWidth={2} aria-hidden /> Sign out everywhere</>
              : dialog?.kind === "hardDelete"
                ? <><Trash2 size={13} strokeWidth={2} aria-hidden /> Delete permanently</>
              : <><Check size={13} strokeWidth={2} aria-hidden /> Confirm</>}
            </Button>
          </div>
        </form>
        )}
      </Dialog>
    </>
  );
}

