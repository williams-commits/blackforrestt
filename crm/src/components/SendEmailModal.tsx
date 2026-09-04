"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/**
 * Compose-and-send email modal (spec §6/§36): opened from any record page's
 * action bar. Sends via the CRM's SMTP transport, logs to the timeline,
 * and can optionally create a follow-up task.
 */
export function SendEmailModal({
  subjectType,
  subjectId,
  toEmail,
  toName,
  onClose,
}: {
  subjectType: SubjectType;
  subjectId: string;
  toEmail: string | null;
  toName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [to, setTo] = useState(toEmail ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [createFollowUp, setCreateFollowUp] = useState(true);
  const [followUpInDays, setFollowUpInDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    void fetch("/api/emails/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setEmailEnabled(body?.data?.configured ?? false))
      .catch(() => setEmailEnabled(false));
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc: cc || undefined,
          subject,
          body,
          subjectType,
          subjectId,
          createFollowUp,
          followUpInDays,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Send failed.");
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => onClose(), 1200);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="dialog" aria-modal="true">
      <form
        method="post"
        onSubmit={send}
        className="w-full max-w-2xl space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Send email</h2>
          <button type="button" onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" aria-label="Close">
            ×
          </button>
        </div>

        {!emailEnabled ? (
          <div className="rounded-md border border-amber-300 bg-[var(--warning-bg)] p-3 text-sm text-[var(--warning)]">
            Email sending is not configured. Set <code className="rounded bg-amber-100 px-1">SMTP_URL</code> in the
            environment to enable this feature.
          </div>
        ) : null}

        {success ? (
          <div className="rounded-md border border-green-300 bg-[var(--success-bg)] p-3 text-sm text-green-800">
            ✓ Email sent successfully{createFollowUp ? ` — follow-up task created for ${followUpInDays} day(s)` : ""}.
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="em-to" className="mb-1 block text-sm font-medium">
              To <span aria-hidden>*</span>
            </label>
            <input
              id="em-to"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
              disabled={busy || success}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="em-cc" className="mb-1 block text-sm font-medium">Cc</label>
            <input
              id="em-cc"
              type="email"
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              disabled={busy || success}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="em-subject" className="mb-1 block text-sm font-medium">
            Subject <span aria-hidden>*</span>
          </label>
          <input
            id="em-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            minLength={1}
            maxLength={300}
            disabled={busy || success}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="em-body" className="mb-1 block text-sm font-medium">
            Message <span aria-hidden>*</span>
          </label>
          <textarea
            id="em-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            minLength={1}
            maxLength={20000}
            rows={10}
            disabled={busy || success}
            className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            placeholder={`Hi ${toName.split(" ")[0] || "there"},`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-hover)] p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createFollowUp}
              onChange={(event) => setCreateFollowUp(event.target.checked)}
              disabled={busy || success}
            />
            Create follow-up task in
          </label>
          <select
            aria-label="Follow-up days"
            value={followUpInDays}
            onChange={(event) => setFollowUpInDays(parseInt(event.target.value, 10))}
            disabled={!createFollowUp || busy || success}
            className="input"
          >
            {[1, 2, 3, 5, 7, 14, 30].map((days) => (
              <option key={days} value={days}>
                {days} day{days > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || success || !emailEnabled || !to}
            className="btn btn-primary"
            style={{ background: "var(--brand)" }}
          >
            {busy ? "Sending…" : success ? "✓ Sent" : "Send email"}
          </button>
        </div>
      </form>
    </div>
  );
}
