"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/Dialog";
import { Ellipsis } from "lucide-react";
import { ADMIN_ACTION_ICONS, TabIcon, type LucideIcon } from "@/components/ui/tabIcons";
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
  | { kind: "resetPassword" }
  | { kind: "forceSignOut" }
  | { kind: "hardDelete" }
  | null;

type ResetMode = "temporary" | "link";

type ResetResult =
  | { mode: "link"; sent: boolean; previewUrl?: string; expiresAt: string }
  | { mode: "temporary"; temporaryPassword: string };

// Icon per account-state action (keys mirror STATUS_LABELS).
const STATUS_ACTION_ICONS: Record<string, LucideIcon> = {
  SUSPEND: ADMIN_ACTION_ICONS.suspend,
  UNSUSPEND: ADMIN_ACTION_ICONS.unsuspend,
  BLOCK: ADMIN_ACTION_ICONS.block,
  UNBLOCK: ADMIN_ACTION_ICONS.unblock,
  SOFT_DELETE: ADMIN_ACTION_ICONS.softDelete,
  RESTORE: ADMIN_ACTION_ICONS.restore,
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 8 });
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const state = user.deletedAt ? "deleted" : user.blockedAt ? "blocked" : user.suspendedAt ? "suspended" : "active";

  function openMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setMenuMaxHeight(null);
    setMenuOpen(true);
  }

  // Keep the kebab menu inside the viewport: once rendered, measure it
  // against the space under the trigger and flip it ABOVE the kebab when it
  // would run past the bottom edge (rows near the page bottom); clamp with
  // internal scrolling as the last resort on very short viewports.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = menu.offsetHeight;
    const gap = 4;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    if (height <= spaceBelow) {
      setMenuMaxHeight(null);
      return;
    }
    const spaceAbove = rect.top - gap - margin;
    if (height <= spaceAbove) {
      setMenuPos((pos) => ({ ...pos, top: rect.top - gap - height }));
      setMenuMaxHeight(null);
    } else {
      const top = Math.max(margin, window.innerHeight - height - margin);
      setMenuPos((pos) => ({ ...pos, top }));
      setMenuMaxHeight(window.innerHeight - top - margin);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && triggerRef.current && !triggerRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    const close = () => setMenuOpen(false);
    // Keyboard entry: land focus on the first item so arrow-key navigation
    // starts where a mouse user's cursor would.
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    });
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  /** Roving focus within the open menu (Arrow/Home/End), Escape returns to the trigger. */
  function handleMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const items = menuRef.current
      ? Array.from(menuRef.current.querySelectorAll<HTMLElement>("[role=menuitem]"))
      : [];
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex = -1;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    else if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex >= 0) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  }

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
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${state === "active" ? "bg-up/10 text-up" : state === "suspended" ? "bg-brand-soft text-brand" : "bg-down/10 text-down"}`}>
          {state}
        </span>
        <button
          type="button"
          ref={triggerRef}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Actions for ${user.name ?? user.email ?? user.id}`}
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          className="flex h-6 w-7 items-center justify-center rounded border border-border text-text-muted hover:bg-panel-2 hover:text-text"
        >
          <TabIcon icon={Ellipsis} size={16} />
        </button>
      </div>

      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${user.name ?? user.email ?? user.id}`}
          onKeyDown={handleMenuKeyDown}
          className="fixed z-9999 w-48 overflow-hidden overflow-y-auto rounded-lg border border-border bg-canvas py-1 shadow-xl"
          style={{ top: menuPos.top, right: menuPos.right, maxHeight: menuMaxHeight ?? undefined }}
        >
          <MenuItemRow onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setDialog({ kind: "notify" }); }} label="Notify" hint="Send an in-app notification" icon={<TabIcon icon={ADMIN_ACTION_ICONS.notify} />} />
          <MenuItemRow onSelect={() => { setMenuOpen(false); onOpenChat(user); }} label="Chat" hint="Open support conversation" icon={<TabIcon icon={ADMIN_ACTION_ICONS.chat} />} />
          {onManageBalance && (
            <MenuItemRow onSelect={() => { setMenuOpen(false); onManageBalance(user); }} label="Manage balance" hint="Audited finance operation" icon={<TabIcon icon={ADMIN_ACTION_ICONS.manageBalance} />} />
          )}
          {onEditSettings && (
            <MenuItemRow onSelect={() => { setMenuOpen(false); onEditSettings(user); }} label="Settings" hint="Per-user overrides" icon={<TabIcon icon={ADMIN_ACTION_ICONS.settings} />} />
          )}
          {onProposeRole && (
            <>
              <div className="my-1 border-t border-border" />
              <MenuItemRow onSelect={() => { setMenuOpen(false); onProposeRole(user, "ASSIGN_ROLE"); }} label="Grant admin role" hint="Maker-checker approval" icon={<TabIcon icon={ADMIN_ACTION_ICONS.grantRole} />} />
              <MenuItemRow onSelect={() => { setMenuOpen(false); onProposeRole(user, "REVOKE_ROLE"); }} label="Revoke admin role" hint="Maker-checker approval" icon={<TabIcon icon={ADMIN_ACTION_ICONS.revokeRole} />} />
            </>
          )}
          {canManage && !user.isAdmin && (
            <>
              <div className="my-1 border-t border-border" />
              <MenuItemRow
                onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setResetResult(null); setResetMode("temporary"); setDialog({ kind: "resetPassword" }); }}
                label="Reset password"
                hint="Temporary code or emailed link"
                icon={<TabIcon icon={ADMIN_ACTION_ICONS.resetPassword} />}
              />
              <MenuItemRow
                onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setDialog({ kind: "forceSignOut" }); }}
                label="Sign out everywhere"
                hint="Revokes all active sessions"
                icon={<TabIcon icon={ADMIN_ACTION_ICONS.forceSignOut} />}
              />
              <div className="my-1 border-t border-border" />
              <MenuItemRow onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setDialog({ kind: "status", action: statusAction }); }} label={STATUS_LABELS[statusAction].verb} tone={STATUS_LABELS[statusAction].tone} icon={<TabIcon icon={STATUS_ACTION_ICONS[statusAction]} />} />
              {secondaryAction && (
                <MenuItemRow onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setDialog({ kind: "status", action: secondaryAction }); }} label={STATUS_LABELS[secondaryAction].verb} tone="text-down" icon={<TabIcon icon={STATUS_ACTION_ICONS[secondaryAction]} />} />
              )}
              {deleteAction && (
                <>
                  <div className="my-1 border-t border-border" />
                  <MenuItemRow onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setDialog({ kind: "status", action: deleteAction }); }} label={STATUS_LABELS[deleteAction].verb} tone="text-down" hint="Soft-delete; restorable" icon={<TabIcon icon={STATUS_ACTION_ICONS[deleteAction]} />} />
              {state === "deleted" && (
                <>
                  <div className="my-1 border-t border-border" />
                  <MenuItemRow onSelect={() => { setMenuOpen(false); setError(null); setNote(""); setDialog({ kind: "hardDelete" }); }} label="Delete permanently" tone="text-down" hint="Purges all records; irreversible" icon={<TabIcon icon={ADMIN_ACTION_ICONS.hardDelete} />} />
                </>
              )}
                </>
              )}
            </>
          )}
        </div>,
        document.body,
      )}

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
                <div className="rounded border border-up/30 bg-up/10 px-3 py-2 text-xs text-up">
                  New sign-in password generated — it is shown below exactly once.
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 rounded border border-border bg-panel px-3 py-2.5 text-center font-mono text-xl font-bold tracking-widest">{resetResult.temporaryPassword}</code>
                    <button type="button" onClick={() => void copyValue(resetResult.temporaryPassword)} className="shrink-0 rounded border border-border px-3 py-2.5 text-xs hover:bg-panel-2">
                      {copiedValue ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[10px] text-text-faint">
                    Case-sensitive, 6 characters. Deliver it to the user through a secure channel — the user should
                    change it after signing in (Account → Security).
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  All active sessions were signed out and any login lockout was cleared — the user signs in fresh
                  with this password. This action is written to the audit trail (the password itself is never recorded).
                </p>
              </>
            ) : (
              <>
                <div className={`rounded border px-3 py-2 text-xs ${resetResult.sent ? "border-up/30 bg-up/10 text-up" : "border-brand/30 bg-brand-soft text-brand"}`}>
                  {resetResult.sent
                    ? `Reset link emailed to ${user.email}.`
                    : "Email delivery is not configured — use the link below."}
                </div>
                <p className="text-xs text-text-muted">
                  Valid until {fmtDateTime(resetResult.expiresAt)}. The user sets their own new password;
                  existing sessions stay signed in until the reset is completed.
                </p>
                {resetResult.previewUrl && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium">Single-use reset link</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={resetResult.previewUrl}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="h-9 min-w-0 flex-1 rounded border border-border bg-panel px-2 font-mono text-[11px] outline-none"
                      />
                      <button type="button" onClick={() => void copyValue(resetResult.previewUrl!)} className="shrink-0 rounded border border-border px-3 text-xs hover:bg-panel-2">
                        {copiedValue ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-faint">Hand this to the user through a secure channel — anyone with the link can set the password.</p>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => { setDialog(null); setError(null); setResetResult(null); }} className="rounded border border-border px-3 py-2 text-xs hover:bg-panel-2">Close</button>
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
                <label className="mb-1 block text-xs font-medium" htmlFor="notify-title">Title</label>
                <input id="notify-title" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="notify-body">Message</label>
                <textarea id="notify-body" required minLength={3} maxLength={2000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
              </div>
            </>
          ) : dialog?.kind === "hardDelete" ? (
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="purge-note">Purge reason (audited, min 10 chars)</label>
              <textarea
                id="purge-note"
                required
                minLength={10}
                maxLength={500}
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="GDPR erasure request, fraud cleanup, or compliance reference…"
                className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand resize-none"
              />
              <p className="mt-2 text-[11px] text-down">
                This cannot be undone. The account, positions, transactions, documents, and chat history are
                destroyed immediately. The audit entry recording this deletion is permanent. Accounts that ever
                moved funds are protected by the ledger and will be refused.
              </p>
            </div>
          ) : dialog?.kind === "forceSignOut" ? (
            <p className="text-xs text-text-muted">
              All devices and browsers are signed out immediately — useful when an account may be
              compromised, or before handing control back to a customer after support. Open
              WebSockets drop on their next validation. The action is written to the audit trail.
            </p>
          ) : dialog?.kind === "resetPassword" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Reset method">
                <button
                  type="button"
                  onClick={() => setResetMode("temporary")}
                  aria-pressed={resetMode === "temporary"}
                  className={`rounded px-3 py-2 text-xs font-semibold ${resetMode === "temporary" ? "bg-brand text-white" : "border border-border bg-canvas hover:bg-panel-2"}`}
                >
                  Generate temporary password
                </button>
                <button
                  type="button"
                  onClick={() => setResetMode("link")}
                  aria-pressed={resetMode === "link"}
                  className={`rounded px-3 py-2 text-xs font-semibold ${resetMode === "link" ? "bg-brand text-white" : "border border-border bg-canvas hover:bg-panel-2"}`}
                >
                  Email reset link
                </button>
              </div>
              {resetMode === "temporary" ? (
                <p className="text-xs text-text-muted">
                  Generates a random 6-character alphanumeric password and sets it on{" "}
                  <strong className="text-text">{user.email}</strong> immediately. All active sessions are signed out
                  and any login lockout is cleared, so the user can sign in right away. The code is shown to you once —
                  deliver it securely; the user should change it after signing in.
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  The link goes to <strong className="text-text">{user.email}</strong> and is valid for 30 minutes.
                  Completing the reset signs out all of the user&apos;s active sessions and clears any login lockout.
                  Issuing a new link invalidates previously issued, unused links. This action is written to the audit trail.
                </p>
              )}
            </div>
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
            <button type="submit" disabled={busy} className={`rounded px-3 py-2 text-xs text-white disabled:opacity-50 ${dialog?.kind === "status" ? "bg-down" : "bg-brand"}`}>
              {busy ? "Working…" : dialog?.kind === "notify" ? "Send notification" : dialog?.kind === "resetPassword" ? (resetMode === "temporary" ? "Generate password" : "Send reset link") : dialog?.kind === "forceSignOut" ? "Sign out everywhere" : dialog?.kind === "hardDelete" ? "Delete permanently" : "Confirm"}
            </button>
          </div>
        </form>
        )}
      </Dialog>
    </>
  );
}

function MenuItemRow({ onSelect, label, hint, tone = "text-text", icon }: { onSelect: () => void; label: string; hint?: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs transition-colors hover:bg-panel-2 focus:bg-panel-2 focus:outline-none"
    >
      {icon}
      <span className={`min-w-0 flex-1 ${tone}`}>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-[9px] text-text-faint">{hint}</span>}
      </span>
    </button>
  );
}
