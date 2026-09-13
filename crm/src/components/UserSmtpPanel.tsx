"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * Admin panel: manage a user's personal SMTP credentials (per-user mail
 * sending) and jump to that user's mailbox view. The password is write-only —
 * it is encrypted at rest and never returned by the API.
 */

interface SmtpConfigView {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  fromName: string | null;
  fromAddress: string;
}

export function UserSmtpPanel({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [config, setConfig] = useState<SmtpConfigView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState(userEmail);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing" | "removing">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/smtp`);
      const body = await response.json().catch(() => null);
      if (body?.data) {
        setConfig(body.data);
        setHost(body.data.host);
        setPort(String(body.data.port));
        setSecure(Boolean(body.data.secure));
        setUsername(body.data.username);
        setFromName(body.data.fromName ?? "");
        setFromAddress(body.data.fromAddress ?? userEmail);
      }
    } finally {
      setLoaded(true);
    }
  }, [userId, userEmail]);

  useEffect(() => { void load(); }, [load]);

  function payload() {
    return {
      host: host.trim(),
      port: Number(port),
      secure,
      username: username.trim(),
      ...(password ? { password } : {}),
      fromName: fromName.trim() || undefined,
      fromAddress: fromAddress.trim(),
    };
  }

  async function save() {
    setBusy("saving"); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/smtp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error ?? "Save failed."); return; }
      setNotice("SMTP settings saved — this user's email now sends through their own server.");
      setPassword("");
      await load();
    } finally {
      setBusy("idle");
    }
  }

  async function test() {
    setBusy("testing"); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/smtp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(password ? payload() : {}),
      });
      const body = await response.json().catch(() => null);
      if (body?.data?.ok) setNotice("✓ Connection verified.");
      else setError(body?.data?.error ? `Connection failed: ${body.data.error}` : "Connection failed.");
    } finally {
      setBusy("idle");
    }
  }

  async function remove() {
    setBusy("removing"); setError(null); setNotice(null);
    const response = await fetch(`/api/admin/users/${userId}/smtp`, { method: "DELETE" });
    if (response.ok) {
      setNotice("Override removed — this user falls back to the global SMTP settings.");
      setConfig(null); setHost(""); setPort("587"); setUsername(""); setPassword("");
      setFromName(""); setFromAddress(userEmail);
    } else {
      setError("Remove failed.");
    }
    setBusy("idle");
  }

  const inputClass =
    "w-full rounded-md border border-(--border-strong) px-2.5 py-1.5 text-sm focus:border-(--brand) focus:outline-none focus:ring-2 focus:ring-(--brand)/20";

  if (loaded && !config && !host) {
    // Still render the empty form — first-time setup for this user.
  }

  return (
    <div className="mt-4 border-t border-(--border-default) pt-4" data-testid="user-smtp-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-(--text-tertiary)">Personal SMTP (email sending identity)</p>
        <div className="flex items-center gap-2">
          <Link href={`/emails?userId=${userId}&userName=${encodeURIComponent(userEmail)}`} className="text-xs font-medium text-(--brand) hover:underline">
            View their emails →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-(--text-secondary)">
        When set, this user&#39;s outgoing email is sent through their own mail server. Without it, the global SMTP is used.
      </p>
      {notice ? <p role="status" className="mt-2 rounded-md bg-(--success-bg) px-3 py-2 text-sm text-(--success)">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-(--text-secondary)">SMTP host
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" className={`mt-1 ${inputClass}`} />
        </label>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <label className="text-xs text-(--text-secondary)">Port
            <input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-(--text-secondary)">
            <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} /> TLS/SSL
          </label>
        </div>
        <label className="text-xs text-(--text-secondary)">Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-(--text-secondary)">
          Password {config?.hasPassword ? "(saved — leave blank to keep)" : ""}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-(--text-secondary)">From name
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="e.g. Klaus Bergmann" className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-(--text-secondary)">From address
          <input type="email" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy !== "idle"} onClick={() => void save()} className="rounded-md border border-(--border-strong) px-3 py-1.5 text-xs font-semibold hover:bg-(--bg-hover) disabled:opacity-50">
          {busy === "saving" ? "Saving…" : "Save SMTP"}
        </button>
        <button type="button" disabled={busy !== "idle" || !host || !username} onClick={() => void test()} className="rounded-md border border-(--border-strong) px-3 py-1.5 text-xs font-medium hover:bg-(--bg-hover) disabled:opacity-50">
          {busy === "testing" ? "Testing…" : "Test connection"}
        </button>
        {config ? (
          <button type="button" disabled={busy !== "idle"} onClick={() => void remove()} className="rounded-md border border-(--border-strong) px-3 py-1.5 text-xs font-medium text-(--error) hover:bg-(--bg-hover) disabled:opacity-50">
            Remove override
          </button>
        ) : null}
      </div>
    </div>
  );
}
