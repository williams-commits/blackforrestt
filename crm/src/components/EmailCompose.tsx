"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

const RECORD_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
};

/**
 * Email compose — the single composer used everywhere (record pages, the
 * mailbox, replies). Full-screen-centered modal with:
 *   - To / CC, subject, body; ⌘/Ctrl+Enter sends
 *   - draft autosave to localStorage (survives accidental closes)
 *   - a prominent warning when SMTP is not configured (sends are archived
 *     as FAILED rather than lost)
 *   - after send: a link straight into the Emails module
 * When subjectType/subjectId are given the email is linked to that record
 * (and may create a follow-up task); without them it is an unlinked
 * mailbox send visible to every EMAILS_VIEW holder.
 */

export interface EmailComposeProps {
  subjectType?: SubjectType;
  subjectId?: string;
  toEmail?: string | null;
  toName?: string;
  initialSubject?: string;
  initialBody?: string;
  onClose: () => void;
  onSent?: () => void;
}

const MAX_BODY = 20_000;

export function EmailCompose({
  subjectType,
  subjectId,
  toEmail,
  toName,
  initialSubject,
  initialBody,
  onClose,
  onSent,
}: EmailComposeProps) {
  const linked = Boolean(subjectType && subjectId);
  const draftKey = `crm-email-draft:${subjectType ?? "free"}:${subjectId ?? toEmail ?? "new"}`;

  const [to, setTo] = useState(toEmail ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [ccVisible, setCcVisible] = useState(false);
  const [bccVisible, setBccVisible] = useState(false);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [createFollowUp, setCreateFollowUp] = useState(linked);
  const [followUpInDays, setFollowUpInDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Draft autosave — restored on mount, cleared after a successful send.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved && !initialBody) {
        const draft = JSON.parse(saved) as { to?: string; cc?: string; bcc?: string; subject?: string; body?: string };
        if (draft.to && !toEmail) setTo(draft.to);
        if (draft.cc) { setCc(draft.cc); setCcVisible(true); }
        if (draft.bcc) { setBcc(draft.bcc); setBccVisible(true); }
        if (draft.subject && !initialSubject) setSubject(draft.subject);
        if (draft.body) setBody(draft.body);
      }
    } catch { /* draft restore is best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const saveDraft = useCallback((next: { to: string; cc: string; bcc: string; subject: string; body: string }) => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(next));
    } catch { /* storage full/blocked — drafts are best-effort */ }
  }, [draftKey]);

  useEffect(() => {
    // A pristine composer must never autosave — otherwise its empty state
    // would wipe the stored draft before the restore effect has run.
    if (!to && !cc && !subject && !body) return;
    const timer = window.setTimeout(
      () => saveDraft({ to, cc, bcc, subject, body }),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [to, cc, bcc, subject, body, saveDraft]);

  // Is SMTP configured? null = unknown (check in flight).
  useEffect(() => {
    void fetch("/api/emails/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setSmtpConfigured(Boolean(body?.data?.configured)))
      .catch(() => setSmtpConfigured(false));
  }, []);

  const send = useCallback(async () => {
    setError(null);
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("To, subject, and message are required.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          body,
          ...(linked ? { subjectType, subjectId } : {}),
          createFollowUp: linked ? createFollowUp : undefined,
          followUpInDays: linked ? followUpInDays : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; emailId?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Send failed.");
        return;
      }
      try { window.localStorage.removeItem(draftKey); } catch { /* best-effort */ }
      setSentId(result?.emailId ?? "sent");
      onSent?.();
    } finally {
      setBusy(false);
    }
  }, [to, cc, bcc, subject, body, linked, subjectType, subjectId, createFollowUp, followUpInDays, draftKey, onSent]);

  // ⌘/Ctrl+Enter sends from any field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!busy && !sentId) void send();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, busy, sentId]);

  const inputClass =
    "w-full rounded-md border border-(--border-strong) px-3 py-2 text-sm focus:border-(--brand) focus:outline-none focus:ring-2 focus:ring-(--brand)/20 disabled:opacity-60";
  const canSend = !busy && !sentId && Boolean(to.trim()) && Boolean(subject.trim()) && Boolean(body.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Compose email">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-surface) text-(--text-primary) shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{sentId ? "Email sent" : "New email"}</h2>
            <p className="truncate text-xs text-(--text-tertiary)">
              {linked
                ? "Linked to this record — it appears in the record's email history."
                : "Unlinked send — visible in the shared mailbox to every EMAILS_VIEW holder."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-xl leading-none text-(--text-tertiary) hover:text-(--text-secondary)" aria-label="Close composer">×</button>
        </div>

        {/* SMTP warning — the explicit not-configured notice */}
        {smtpConfigured === false ? (
          <div role="alert" className="flex items-start gap-2 border-b border-(--warning-border) bg-(--warning-bg) px-5 py-3 text-sm text-(--warning)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              <strong>SMTP is not configured.</strong> Sending is disabled — set{" "}
              <code className="rounded bg-(--bg-subtle) px-1">SMTP_URL</code> (and{" "}
              <code className="rounded bg-(--bg-subtle) px-1">SMTP_FROM</code>) in the environment, then reload.
            </span>
          </div>
        ) : null}

        {sentId ? (
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-2 rounded-md border border-(--success-border) bg-(--success-bg) p-3 text-sm text-(--success)">
              <span aria-hidden>✓</span> Email sent{createFollowUp && linked ? ` — follow-up task created for ${followUpInDays} day(s)` : ""}.
            </div>
            <div className="flex gap-2">
              {linked && subjectType ? (
                <Link href={`/${RECORD_PATH[subjectType]}/${subjectId}`} className="btn btn-secondary">
                  View record
                </Link>
              ) : null}
              <Link href="/emails" className="btn btn-primary" style={{ background: "var(--brand)" }}>
                Open mailbox →
              </Link>
              <button type="button" onClick={onClose} className="btn btn-secondary ml-auto">Close</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => { event.preventDefault(); void send(); }}
            className="space-y-4 p-5"
          >
            {error ? (
              <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p>
            ) : null}

            <div className="divide-y divide-(--border-default) rounded-lg border border-(--border-default)">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <label htmlFor="ec-to" className="w-14 shrink-0 text-sm font-medium text-(--text-secondary)">To</label>
                <input
                  id="ec-to" type="email" value={to} required disabled={busy}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="recipient@example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus
                />
                <div className="flex shrink-0 gap-2">
                  {!ccVisible ? (
                    <button type="button" onClick={() => setCcVisible(true)} className="text-xs font-medium text-(--brand) hover:underline">Cc</button>
                  ) : null}
                  {!bccVisible ? (
                    <button type="button" onClick={() => setBccVisible(true)} className="text-xs font-medium text-(--brand) hover:underline">Bcc</button>
                  ) : null}
                </div>
              </div>
              {ccVisible ? (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <label htmlFor="ec-cc" className="w-14 shrink-0 text-sm font-medium text-(--text-secondary)">Cc</label>
                  <input
                    id="ec-cc" type="email" value={cc} disabled={busy}
                    onChange={(event) => setCc(event.target.value)}
                    placeholder="copy@example.com"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              ) : null}
              {bccVisible ? (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <label htmlFor="ec-bcc" className="w-14 shrink-0 text-sm font-medium text-(--text-secondary)">Bcc</label>
                  <input
                    id="ec-bcc" type="email" value={bcc} disabled={busy}
                    onChange={(event) => setBcc(event.target.value)}
                    placeholder="blind-copy@example.com"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              ) : null}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <label htmlFor="ec-subject" className="w-14 shrink-0 text-sm font-medium text-(--text-secondary)">Subject</label>
                <input
                  id="ec-subject" value={subject} required maxLength={300} disabled={busy}
                  onChange={(event) => setSubject(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                />
              </div>
            </div>

            <textarea
              ref={bodyRef}
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY))}
              required minLength={1} maxLength={MAX_BODY} rows={12} disabled={busy}
              aria-label="Message body"
              placeholder={toName ? `Hi ${toName.split(" ")[0]},` : "Write your message…"}
              className={`${inputClass} min-h-[220px] font-mono text-[13px] leading-relaxed`}
            />
            <p className="text-right text-[11px] text-(--text-tertiary)">
              {body.length.toLocaleString()} / {MAX_BODY.toLocaleString()} · ⌘/Ctrl+Enter to send
            </p>

            {linked ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-(--border-default) bg-(--bg-hover) px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" checked={createFollowUp} disabled={busy}
                    onChange={(event) => setCreateFollowUp(event.target.checked)}
                  />
                  Create follow-up task in
                </label>
                <select
                  aria-label="Follow-up days" value={followUpInDays}
                  onChange={(event) => setFollowUpInDays(parseInt(event.target.value, 10))}
                  disabled={!createFollowUp || busy} className="input"
                >
                  {[1, 2, 3, 5, 7, 14, 30].map((days) => (
                    <option key={days} value={days}>{days} day{days > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-(--border-default) pt-4">
              <p className="text-xs text-(--text-tertiary)">
                {linked ? "Archived to this record's email history." : "Archived to the shared mailbox."}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn btn-secondary" disabled={busy}>Cancel</button>
                <button type="submit" disabled={!canSend || smtpConfigured === false} className="btn btn-primary" style={{ background: "var(--brand)" }}>
                  {busy ? "Sending…" : sentId ? "✓ Sent" : "Send"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
